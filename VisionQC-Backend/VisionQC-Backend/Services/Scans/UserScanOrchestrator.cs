using System.Text.Json;
using fyp.DTOs;
using fyp.Models;
using Microsoft.EntityFrameworkCore;

namespace fyp.Services
{
    public class UserScanOrchestrator : IUserScanOrchestrator
    {
        private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

        private readonly ApplicationDbContext _context;
        private readonly IUserScanFileStorage _fileStorage;
        private readonly IPlantAiService _plantAiService;
        private readonly IPlantDiagnosisKnowledgeService _knowledgeService;
        private readonly IPlantDiagnosisResponseBuilder _diagnosisResponseBuilder;

        public UserScanOrchestrator(
            ApplicationDbContext context,
            IUserScanFileStorage fileStorage,
            IPlantAiService plantAiService,
            IPlantDiagnosisKnowledgeService knowledgeService,
            IPlantDiagnosisResponseBuilder diagnosisResponseBuilder)
        {
            _context = context;
            _fileStorage = fileStorage;
            _plantAiService = plantAiService;
            _knowledgeService = knowledgeService;
            _diagnosisResponseBuilder = diagnosisResponseBuilder;
        }

        public async Task<ScanDetailsDto> CreateScanAsync(
            Guid userId,
            PlantScanDto dto,
            string publicBaseUrl,
            CancellationToken cancellationToken = default)
        {
            //return exception if no image found
            if (dto.Image == null || dto.Image.Length == 0)
            {
                throw new ArgumentException("Please add a plant image first.");
            }

            //return exception if no alias entered
            var aliasValue = dto.Alias.Trim();
            if (string.IsNullOrWhiteSpace(aliasValue))
            {
                throw new ArgumentException("Please choose or enter a plant alias.");
            }

            //throw an error if the entered file is not an image
            var ext = Path.GetExtension(dto.Image.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
            {
                throw new ArgumentException("Only JPG, JPEG, PNG, and WEBP images are allowed.");
            }

            //location
            var locationValue = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();

            //store scannedAt
            var scannedAt = DateTime.UtcNow;

            // initializing StoredScanFile
            StoredScanFile? storedFile = null;

            //Fetch past scans
            var pastScans = await _context.Scans
                .Where(scan => scan.UserId == userId && scan.PlantAlias == aliasValue)
                .OrderByDescending(scan => scan.ScannedAt)
                .Take(5)
                .Select(scan => new AiPastScanSummaryDto
                {
                    ScannedAt = scan.ScannedAt.ToString("O"),
                    Disease = scan.DiseaseRecord == null ? "" : scan.DiseaseRecord.Name,
                    Confidence = scan.Confidence,
                    Analysis = scan.Analysis ?? "",
                    Solution = scan.Solution ?? "",
                    Prevention = scan.Prevention ?? ""
                })
                .ToListAsync(cancellationToken);
            //This saves the uploaded scan image to disk (in webRoot folder)
            //FileStorage of UserScanFileStorage 
            storedFile = await _fileStorage.SaveAsync(dto.Image, cancellationToken);

            try
            {   
                //send the image to the ai
                AiDiagnoseResponseDto rawAiResult;
                await using (var imageStream = new FileStream(storedFile.AbsolutePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    //call the api and return the diagnose
                    rawAiResult = await _plantAiService.DiagnoseAsync(
                        imageStream,
                        dto.Image.FileName,
                        storedFile.ContentType,
                        aliasValue,
                        locationValue,
                        pastScans,
                        cancellationToken);
                }
                //fallback methods if the disease field is empty , to fill teh info related to it
                var knowledgeEnrichedDiagnosis = await _knowledgeService.EnrichAsync(
                    rawAiResult,
                    aliasValue,
                    locationValue,
                    cancellationToken);
                //fallback methods if the rets of the field are empty , fill them instead of crashing
                var finalDiagnosis = _diagnosisResponseBuilder.Build(
                    knowledgeEnrichedDiagnosis,
                    aliasValue,
                    locationValue);

                //If dto.Disease is empty, use the AI/final diagnosis disease
                var diseaseName = string.IsNullOrWhiteSpace(dto.Disease) ? finalDiagnosis.Disease : dto.Disease.Trim();

                //Get the DiseaseId by matching the returned disease form the ia to one from teh db
                var diseaseRecord = await GetDiseaseAsync(diseaseName, cancellationToken);

                var aliasRecord = await _context.PlantAliases
                    .FirstOrDefaultAsync(a => a.UserId == userId && a.Alias == aliasValue, cancellationToken);

                //additional verification
                if (aliasRecord == null)
                {
                    throw new ArgumentException("Plant alias does not exist.");
                }

                if (!string.IsNullOrWhiteSpace(locationValue))
                {
                    aliasRecord.Location = locationValue;
                }

                aliasRecord.UpdatedAt = scannedAt;
                aliasRecord.LastScannedAt = scannedAt;

                var scan = new Scan
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    PlantAliasId = aliasRecord.Id,
                    PlantAliasRecord = aliasRecord,
                    PlantAlias = aliasValue,
                    Location = locationValue,
                    ImagePath = storedFile.RelativePath,
                    ScannedAt = scannedAt,
                    DiseaseId = diseaseRecord?.Id,
                    DiseaseRecord = diseaseRecord,
                    Confidence = dto.Confidence ?? finalDiagnosis.Confidence,
                    SeverityLevel = finalDiagnosis.SeverityLevel,
                    Analysis = string.IsNullOrWhiteSpace(dto.Analysis) ? finalDiagnosis.Analysis : dto.Analysis.Trim(),
                    Solution = string.IsNullOrWhiteSpace(dto.Solution) ? finalDiagnosis.Solution : dto.Solution.Trim(),
                    RecommendedProducts = JsonSerializer.Serialize(finalDiagnosis.RecommendedProducts),
                    CareSteps = JsonSerializer.Serialize(finalDiagnosis.CareSteps),
                    Prevention = finalDiagnosis.Prevention,
                    RescanRecommended = finalDiagnosis.RescanRecommended,
                    RescanDays = finalDiagnosis.RescanDays,
                    RescanReason = finalDiagnosis.RescanReason
                };

                //add the scan to teh history
                _context.Scans.Add(scan);
                await _context.SaveChangesAsync(cancellationToken);

                //return the scan
                return new ScanDetailsDto
                {
                    Id = scan.Id,
                    PlantAlias = scan.PlantAlias,
                    Location = scan.Location,
                    ScannedAt = scan.ScannedAt,
                    Disease = scan.DiseaseRecord?.Name,
                    Analysis = scan.Analysis,
                    Solution = scan.Solution,
                    Confidence = scan.Confidence,
                    SeverityLevel = scan.SeverityLevel,
                    Provider = string.IsNullOrWhiteSpace(dto.Provider) ? finalDiagnosis.Provider : dto.Provider.Trim(),
                    Model = string.IsNullOrWhiteSpace(dto.Model) ? finalDiagnosis.Model : dto.Model.Trim(),
                    ImageUrl = BuildAbsoluteUrl(publicBaseUrl, scan.ImagePath),
                    RecommendedProducts = DeserializeList(scan.RecommendedProducts),
                    CareSteps = DeserializeList(scan.CareSteps),
                    Prevention = scan.Prevention ?? "",
                    RescanRecommended = scan.RescanRecommended,
                    RescanDays = scan.RescanDays,
                    RescanReason = scan.RescanReason ?? ""
                };
            }
            //Possible cases
                // AI diagnosis fails
                // disease label is not configured
                // plant alias does not exist
                // database save fails
                // JSON processing fails
            catch
            {
                if (storedFile != null)
                {
                    //Delete the uploaded image file from the server if we already did save the uploaded image to disk
                    _fileStorage.Delete(storedFile.AbsolutePath);
                }
                throw;
            }
        }

        private static string BuildAbsoluteUrl(string publicBaseUrl, string relativePath)
        {
            var normalizedBaseUrl = publicBaseUrl.TrimEnd('/');
            return $"{normalizedBaseUrl}{relativePath}";
        }

        // Given the AI disease label, find the matching disease row from the database
        private async Task<Disease?> GetDiseaseAsync(string? diseaseName, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(diseaseName))
            {
                return null;
            }

            var normalizedName = diseaseName.Trim();
           
           //Fetch the DiseaseId to link the return disease to one from the db via the diseaseId
            var existing = await _context.Diseases
                .FirstOrDefaultAsync(d => d.Name.ToLower() == normalizedName.ToLower(), cancellationToken);

            if (existing != null)
            {
                return existing;
            }
            //Throw an exception if label is missing
            throw new ArgumentException($"Disease label '{normalizedName}' is not configured.");
        }

        //Deserialize list from C# list into a json
        private static List<string> DeserializeList(string? json)
        {
            return string.IsNullOrWhiteSpace(json)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
    }
}
