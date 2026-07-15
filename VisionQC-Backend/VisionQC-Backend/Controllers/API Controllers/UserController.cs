using fyp.DTOs;
using fyp.Models;
using fyp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;

//here every endpoint requires a valid JWT and role Regular or Admin because its role based
namespace fyp.Controllers
{
    // Authenticated user API for profile management, plant aliases, and scan history.
    [ApiController]
    [Route("api/v1/users")]
    [Authorize(Roles = "Regular,Admin")]
    public class UserController : ControllerBase
    {

        private readonly ApplicationDbContext _context;
        private readonly IUserScanOrchestrator _userScanOrchestrator;

        public UserController(
            ApplicationDbContext context,
            IUserScanOrchestrator userScanOrchestrator)
        {
            _context = context;
            _userScanOrchestrator = userScanOrchestrator;
        }

        // Decode the id from the token 
        private bool TryGetUserId(out Guid userId)
        {
            userId = Guid.Empty;
            //NameIdentifier, JwtRegisteredClaimNames and sub: these are the field name of the userId 
            var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue("sub");

            return Guid.TryParse(idStr, out userId);
        }

        // Load the current user only if the account exists and is active.
        private async Task<User?> GetActiveUserAsync(Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null || !user.IsActive) return null;
            return user;
        }

        // Built the full path example: https://localhost:7125/uploads/scans/image.jpeg
        private string BuildAbsoluteUrl(string relativePath)
        {
            return $"{Request.Scheme}://{Request.Host}{relativePath}";
        }

        // Return the authenticated user's basic profile.
        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            // Resolve the current user from the JWT before loading profile data
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //AsNoTracking() means: We only want to read this user, not edit/save it,
            // so the EF do not watch this object for changes (keep a copy of the original values it loaded from the database)
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound(new { message = "User not found" });
            //Forbid returns 403 Forbidden
            if (!user.IsActive) return Forbid();

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Role,
                user.IsActive
            });
        }

        // Update the authenticated user's editable profile fields.
        [HttpPatch("me")]
        public async Task<IActionResult> EditMe([FromBody] EditMyProfileDto dto)
        {
            // This endpoint updates only the fields a user is allowed to edit about themselves
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //if not active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();
            
            //Edit full name
            if (!string.IsNullOrWhiteSpace(dto.FullName))
                user.FullName = dto.FullName.Trim();

            //save change
            await _context.SaveChangesAsync();
            return Ok(new { message = "Profile updated successfully." });
        }

        // Change the authenticated user's password after verifying the current one
        [HttpPut("me/password")]
        public async Task<IActionResult> ChangeMyPassword([FromBody] ChangeMyPasswordDto dto)
        {   
            //check token
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            // Require the old password so a stolen token alone cannot change credentials
            if (!BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash))
                return BadRequest(new { message = "Your current password is incorrect." });

            //Hash the password
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            //save the change
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password updated successfully." });
        }

        // Return only the user's alias names for quick picker-style screens.
        [HttpGet("me/aliases")]
        public async Task<IActionResult> GetMyAliases()
        {
            // check user
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //if active user
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //Get aliases
            var aliases = await _context.PlantAliases.AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderBy(a => a.Alias)
                .Select(a => a.Alias)
                .ToListAsync();

            return Ok(aliases);
        }

        // Return a specific alias
        [HttpGet("me/plants")]
        public async Task<IActionResult> GetMyPlants()
        {
            // Load aliases and scans separately, then merge them into one response model.
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check if active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //Fetch alias
            var aliases = await _context.PlantAliases.AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderBy(a => a.Alias)
                .ToListAsync();

            //fetch scans
            var scans = await _context.Scans.AsNoTracking()
                .Include(s => s.DiseaseRecord)
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();

            // Group scans by alias name so each alias can expose its latest scan summary
            var scansByAlias = scans
                .Where(s => !string.IsNullOrWhiteSpace(s.PlantAlias))
                .GroupBy(s => s.PlantAlias.Trim())
                .ToDictionary(g => g.Key, g => g.ToList());

            var rows = aliases.Select(alias =>
            {
                //Find scans for this plant alias
                scansByAlias.TryGetValue(alias.Alias, out var aliasScans);
                //returns the last scan
                var latest = aliasScans?.FirstOrDefault();

                return new PlantAliasListItemDto
                {
                    Id = alias.Id,
                    Alias = alias.Alias,
                    Location = alias.Location,
                    CreatedAt = alias.CreatedAt,
                    UpdatedAt = alias.UpdatedAt,
                    LastScannedAt = alias.LastScannedAt,
                    ScanCount = aliasScans?.Count ?? 0,
                    LatestScanId = latest?.Id,
                    LatestDisease = latest?.DiseaseRecord?.Name,
                    LatestAnalysis = latest?.Analysis,
                    LatestSolution = latest?.Solution,
                    LatestImageUrl = latest != null ? BuildAbsoluteUrl(latest.ImagePath) : null,
                };
            }).ToList();

            return Ok(rows);
        }

        // Create a new plant alias owned by the authenticated user
        [HttpPost("me/plants")]
        public async Task<IActionResult> CreatePlantAlias([FromBody] CreatePlantAliasDto dto)
        {
            // Users can create their own friendly plant names that future scans refer to.
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //If name null
            var aliasValue = dto.Alias.Trim();
            if (string.IsNullOrWhiteSpace(aliasValue))
                return BadRequest(new { message = "Alias is required." });

            // Enforce per-user alias uniqueness before inserting.
            var existingAlias = await _context.PlantAliases.AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Alias == aliasValue);

            if (existingAlias != null)
                return Conflict(new { message = "This plant alias already exists." });

            var timestamp = DateTime.UtcNow;
            var locationValue = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();

            var aliasRecord = new PlantAlias
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Alias = aliasValue,
                Location = locationValue,
                CreatedAt = timestamp,
                UpdatedAt = timestamp
            };
            //add alias
            _context.PlantAliases.Add(aliasRecord);
            await _context.SaveChangesAsync();

            return Ok(new PlantAliasListItemDto
            {
                Id = aliasRecord.Id,
                Alias = aliasRecord.Alias,
                Location = aliasRecord.Location,
                CreatedAt = aliasRecord.CreatedAt,
                UpdatedAt = aliasRecord.UpdatedAt,
                LastScannedAt = aliasRecord.LastScannedAt,
                ScanCount = 0,
                LatestScanId = null,
                LatestDisease = null,
                LatestAnalysis = null,
                LatestSolution = null,
                LatestImageUrl = null
            });
        }

        // Delete one of the user's saved plant aliases.
        [HttpDelete("me/plants/{plantAliasId:guid}")]
        public async Task<IActionResult> DeletePlantAlias([FromRoute] Guid plantAliasId)
        {
            // Only aliases owned by the authenticated user can be deleted here.
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            var aliasRecord = await _context.PlantAliases
                .FirstOrDefaultAsync(a => a.Id == plantAliasId && a.UserId == userId);

            //additional validation for cases like Frontend sends wrong plantAliasId by bug, Before delete request happens, alias is deleted elsewhere
            if (aliasRecord == null)
                return NotFound(new { message = "Plant alias not found." });

            _context.PlantAliases.Remove(aliasRecord);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Plant alias deleted successfully."
            });
        }

        // Update a plant alias and keep related scans in sync if the alias name changes.
        [HttpPut("me/plants/{plantAliasId:guid}")]
        public async Task<IActionResult> UpdatePlantAlias([FromRoute] Guid plantAliasId, [FromBody] UpdatePlantAliasDto dto)
        {
            
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });
            
            //check active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //fetch alias
            var aliasRecord = await _context.PlantAliases
                .FirstOrDefaultAsync(a => a.Id == plantAliasId && a.UserId == userId);

            if (aliasRecord == null)
                return NotFound(new { message = "Plant alias not found." });
            //For cases like:
                // Frontend bug sends empty alias
                // Mobile app version is outdated
                // User loses network and retries weird payload
                // Someone calls the API directly with Postman/Swagger
                // A malicious user edits the request
            var aliasValue = dto.Alias.Trim();
            if (string.IsNullOrWhiteSpace(aliasValue))
                return BadRequest(new { message = "Alias is required." });
         
            var conflictingAlias = await _context.PlantAliases.AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Alias == aliasValue && a.Id != plantAliasId);

            if (conflictingAlias != null)
                return Conflict(new { message = "Another plant alias already uses this name." });
            //save old value , so it can be upadte with the new alias later
            var previousAliasValue = aliasRecord.Alias;
            var locationValue = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();

            //change values
            aliasRecord.Alias = aliasValue;
            aliasRecord.Location = locationValue;
            aliasRecord.UpdatedAt = DateTime.UtcNow;

            // If the alias text changed, mirror that change into previously saved scans.
            if (!string.Equals(previousAliasValue, aliasValue, StringComparison.Ordinal))
            {
                var relatedScans = await _context.Scans
                    .Where(s => s.UserId == userId && s.PlantAliasId == plantAliasId)
                    .ToListAsync();

                foreach (var scan in relatedScans)
                {
                    scan.PlantAlias = aliasValue;
                }
            }

            await _context.SaveChangesAsync();

            // Return the refreshed alias summary expected by the frontend list view.
            var latestScan = await _context.Scans.AsNoTracking()
                .Include(s => s.DiseaseRecord)
                .Where(s => s.UserId == userId && s.PlantAliasId == plantAliasId)
                .OrderByDescending(s => s.ScannedAt)
                .FirstOrDefaultAsync();

            var scanCount = await _context.Scans.AsNoTracking()
                .CountAsync(s => s.UserId == userId && s.PlantAliasId == plantAliasId);

            return Ok(new PlantAliasListItemDto
            {
                Id = aliasRecord.Id,
                Alias = aliasRecord.Alias,
                Location = aliasRecord.Location,
                CreatedAt = aliasRecord.CreatedAt,
                UpdatedAt = aliasRecord.UpdatedAt,
                LastScannedAt = aliasRecord.LastScannedAt,
                ScanCount = scanCount,
                LatestScanId = latestScan?.Id,
                LatestDisease = latestScan?.DiseaseRecord?.Name,
                LatestAnalysis = latestScan?.Analysis,
                LatestSolution = latestScan?.Solution,
                LatestImageUrl = latestScan != null ? BuildAbsoluteUrl(latestScan.ImagePath) : null
            });
        }

        // Upload a scan image, call the AI service, persist the result, and return the saved scan details.
        [HttpPost("me/scans")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(10_000_000)]
        public async Task<IActionResult> CreateScan([FromForm] PlantScanDto dto)
        {

            // Identify the caller and reject unauthenticated uploads early.
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check if active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            try
            {
                var publicBaseUrl = $"{Request.Scheme}://{Request.Host}";
                //_userScanOrchestrator of UserScanOrchestrator
                var result = await _userScanOrchestrator.CreateScanAsync(
                    userId,
                    dto,
                    publicBaseUrl,
                    HttpContext.RequestAborted);

                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    message = $"AI diagnosis failed: {ex.Message}"
                });
            }
        }

        // Return the authenticated user's scan history with optional filters.
        [HttpGet("me/scans")]
        public async Task<IActionResult> GetMyHistory(
            [FromQuery] DateTimeOffset? from,
            [FromQuery] DateTimeOffset? to,
            [FromQuery] string? alias)
        {
            // check user
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check if active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //get scans only for this logged-in user
            var q = _context.Scans.AsNoTracking().Where(s => s.UserId == userId);

            //filter by alias
            if (!string.IsNullOrWhiteSpace(alias))
                q = q.Where(s => s.PlantAlias == alias.Trim());

            //filter by date
            if (from.HasValue) q = q.Where(s => s.ScannedAt >= from.Value.UtcDateTime);
            if (to.HasValue) q = q.Where(s => s.ScannedAt <= to.Value.UtcDateTime);

            // only fetch needed field 
            var scanEntities = await q.OrderByDescending(s => s.ScannedAt)
                .Select(s => new
                {
                    s.Id,
                    s.PlantAlias,
                    s.Location,
                    s.ScannedAt,
                    Disease = s.DiseaseRecord == null ? null : s.DiseaseRecord.Name,
                    s.Confidence,
                    s.SeverityLevel,
                    s.RescanRecommended,
                    s.RescanDays,
                    s.RescanReason,
                    s.Analysis,
                    s.Solution,
                    s.ImagePath,
                })
                .ToListAsync();

            //final response 
            var scans = scanEntities.Select(s => new ScanListItemDto
            {
                Id = s.Id,
                PlantAlias = s.PlantAlias,
                Location = s.Location,
                ScannedAt = s.ScannedAt,
                Disease = s.Disease,
                Confidence = s.Confidence,
                SeverityLevel = s.SeverityLevel,
                RescanRecommended = s.RescanRecommended,
                RescanDays = s.RescanDays,
                RescanReason = s.RescanReason ?? "",
                Analysis = s.Analysis,
                Solution = s.Solution,
                ImageUrl = BuildAbsoluteUrl(s.ImagePath)
            }).ToList();

            return Ok(scans);
        }

        // Return the full details for one scan owned by the authenticated user.
        [HttpGet("me/scans/{scanId:guid}")]
        public async Task<IActionResult> GetScanDetails([FromRoute] Guid scanId)
        {
            // check user
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //get the specific scan
            var scan = await _context.Scans.AsNoTracking()
                .Include(s => s.DiseaseRecord)
                .FirstOrDefaultAsync(s => s.Id == scanId && s.UserId == userId);

            if (scan == null)
                return NotFound(new { message = "That scan could not be found." });

            return Ok(new ScanDetailsDto
            {
                Id = scan.Id,
                PlantAlias = scan.PlantAlias,
                Location = scan.Location,
                ScannedAt = scan.ScannedAt,
                Disease = scan.DiseaseRecord?.Name,
                Confidence = scan.Confidence,
                SeverityLevel = scan.SeverityLevel,
                Analysis = scan.Analysis,
                Solution = scan.Solution,
                //converts the stored image path into a usable image URL for frontend/mobile
                ImageUrl = BuildAbsoluteUrl(scan.ImagePath),

                //convert the json into a C# list
                RecommendedProducts = string.IsNullOrWhiteSpace(scan.RecommendedProducts) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(scan.RecommendedProducts) ?? new List<string>(),
                CareSteps = string.IsNullOrWhiteSpace(scan.CareSteps) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(scan.CareSteps) ?? new List<string>(),

                Prevention = scan.Prevention ?? "",

                RescanRecommended = scan.RescanRecommended,
                RescanDays = scan.RescanDays,
                RescanReason = scan.RescanReason ?? ""
            });
        }
    }
}
