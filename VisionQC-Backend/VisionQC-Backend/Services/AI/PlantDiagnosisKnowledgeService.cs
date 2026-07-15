using System.Text.Json;
using fyp.DTOs;

namespace fyp.Services
{
    public class PlantDiagnosisKnowledgeService : IPlantDiagnosisKnowledgeService
    {
        private readonly List<PlantKnowledgeEntry> _entries;

        public PlantDiagnosisKnowledgeService(IWebHostEnvironment env)
        {
            var contentRoot = env.ContentRootPath ?? Directory.GetCurrentDirectory();
            var knowledgePath = Path.Combine(contentRoot, "Data", "plant-diagnosis-knowledge.json");

            if (!File.Exists(knowledgePath))
            {
                _entries = new List<PlantKnowledgeEntry>();
                return;
            }

            var json = File.ReadAllText(knowledgePath);
            _entries = JsonSerializer.Deserialize<List<PlantKnowledgeEntry>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new List<PlantKnowledgeEntry>();
        }

        //fallback if some fields are empty from the ai
        public Task<AiDiagnoseResponseDto> EnrichAsync(
            AiDiagnoseResponseDto diagnosis,
            string alias,
            string? location,
            CancellationToken cancellationToken = default)
        {
            //Fetch from Data/plant-diagnosis-knowledge.json the disease and return its general infos   
            var match = FindEntry(diagnosis.Disease);
            if (match == null)
            {
                return Task.FromResult(diagnosis);
            }

            return Task.FromResult(new AiDiagnoseResponseDto
            {
                Disease = diagnosis.Disease,
                Confidence = diagnosis.Confidence,
                Provider = diagnosis.Provider,
                Model = diagnosis.Model,
                Analysis = string.IsNullOrWhiteSpace(diagnosis.Analysis) ? match.Analysis : diagnosis.Analysis,
                Solution = string.IsNullOrWhiteSpace(diagnosis.Solution) ? match.Solution : diagnosis.Solution,
                SeverityLevel = string.IsNullOrWhiteSpace(diagnosis.SeverityLevel) ? match.SeverityLevel : diagnosis.SeverityLevel,
                RecommendedProducts = diagnosis.RecommendedProducts.Count > 0 ? diagnosis.RecommendedProducts : match.RecommendedProducts,
                CareSteps = diagnosis.CareSteps.Count > 0 ? diagnosis.CareSteps : match.CareSteps,
                Prevention = string.IsNullOrWhiteSpace(diagnosis.Prevention) ? match.Prevention : diagnosis.Prevention,
                RescanRecommended = diagnosis.RescanRecommended || match.RescanRecommended,
                RescanDays = diagnosis.RescanDays > 0 ? diagnosis.RescanDays : match.RescanDays,
                RescanReason = string.IsNullOrWhiteSpace(diagnosis.RescanReason) ? match.RescanReason : diagnosis.RescanReason
            });
        }

        private PlantKnowledgeEntry? FindEntry(string? disease)
        {
            var normalizedDisease = Normalize(disease);
            if (string.IsNullOrWhiteSpace(normalizedDisease))
            {
                return null;
            }

            return _entries.FirstOrDefault(entry =>
                Normalize(entry.Disease) == normalizedDisease ||
                entry.Aliases.Any(alias => Normalize(alias) == normalizedDisease));
        }

        private static string Normalize(string? value)
        {
            return (value ?? string.Empty).Trim().ToLowerInvariant().Replace("_", " ");
        }

        private class PlantKnowledgeEntry
        {
            public string Disease { get; set; } = "";
            public List<string> Aliases { get; set; } = new();
            public string Analysis { get; set; } = "";
            public string Solution { get; set; } = "";
            public string SeverityLevel { get; set; } = "";
            public List<string> RecommendedProducts { get; set; } = new();
            public List<string> CareSteps { get; set; } = new();
            public string Prevention { get; set; } = "";
            public bool RescanRecommended { get; set; }
            public int RescanDays { get; set; }
            public string RescanReason { get; set; } = "";
        }
    }
}
