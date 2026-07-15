using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using fyp.DTOs;
using fyp.Models;
using fyp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace fyp.Controllers
{
    // Authenticated push notification API for browser subscriptions and rescan reminders.
    [ApiController]
    [Route("api/v1/push")]
    [Authorize(Roles = "Regular,Admin")]
    public class PushController : ControllerBase
    {
        // EF Core database access for subscriptions and reminder records.
        private readonly ApplicationDbContext _context;
        // Web push sender abstraction used to expose keys and send notifications.
        private readonly IWebPushService _webPushService;

        public PushController(ApplicationDbContext context, IWebPushService webPushService)
        {
            _context = context;
            _webPushService = webPushService;
        }

        // Read the authenticated user id from the JWT claims
        private bool TryGetUserId(out Guid userId)
        {
            userId = Guid.Empty;

            var idStr =
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
                User.FindFirstValue("sub");

            return Guid.TryParse(idStr, out userId);
        }

        // Load the current user only if the account exists and is active.
        private async Task<User?> GetActiveUserAsync(Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            return user != null && user.IsActive ? user : null;
        }

        // Return the VAPID public key needed by the frontend to register browser push.
        [HttpGet("public-key")]
        public async Task<IActionResult> GetPublicKey()
        {
            // check user
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check if active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //get public key from app settings
            return Ok(new { publicKey = _webPushService.GetPublicKey() });
        }

        // SaveSubscription saves the information needed to send push notifications
        // to this specific user on this specific browser/device.
        [HttpPost("subscriptions")]
        public async Task<IActionResult> SaveSubscription([FromBody] PushSubscriptionDto dto)
        {
            // check user
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check if active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //check dto
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            //In a push subscription, the endpoint is the unique URL that represents this browser/device for push notification
            //The backend does not create this endpoint. The browser creates it when the user allows notifications and the frontend calls the browser Push API
            var endpoint = dto.Endpoint.Trim();
            if (string.IsNullOrWhiteSpace(endpoint))
                return BadRequest(new { message = "Push endpoint is required." });

            // A subscription endpoint is globally unique, so update it if it already exists
            var subscription = await _context.PushSubscriptions
                .FirstOrDefaultAsync(s => s.Endpoint == endpoint);

            
            if (subscription == null)
            {
                subscription = new PushSubscription
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Endpoint = endpoint,
                    // This is the browser subscription public encryption key
                    P256dh = dto.Keys.P256dh.Trim(),
                    //This is a browser-generated auth secret used in encryption
                    Auth = dto.Keys.Auth.Trim(),
                    // browser/device info
                    UserAgent = Request.Headers.UserAgent.ToString(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                };
                _context.PushSubscriptions.Add(subscription);
            }
            else
            {
                subscription.UserId = userId;
                subscription.P256dh = dto.Keys.P256dh.Trim();
                subscription.Auth = dto.Keys.Auth.Trim();
                subscription.UserAgent = Request.Headers.UserAgent.ToString();
                subscription.UpdatedAt = DateTime.UtcNow;
                subscription.IsActive = true;
            }

            //saving the notifications in the db
            await _context.SaveChangesAsync();
            return Ok(new { message = "Push subscription saved." });
        }

        // Enable a reminder for a scan when the AI recommended a future rescan.
        [HttpPost("reminders/{scanId:guid}/enable")]
        public async Task<IActionResult> EnableReminder([FromRoute] Guid scanId)
        {
            
            //check user
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            //check if active
            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            //Fetch the specific scan
            var scan = await _context.Scans
                .FirstOrDefaultAsync(s => s.Id == scanId && s.UserId == userId);

            //Those checks protect EnableReminder from creating invalid reminders
            //So Only create/send a reminder for:
                // 1. a scan that actually exists
                // 2. a scan that belongs to the logged-in user
                // 3. a scan where the AI recommended a rescan
                // 4. a scan with a valid number of rescan days
                // 5. a scan where the user clicked "set reminder"

            //raise an error if scan not found
            if (scan == null)
                return NotFound(new { message = "That scan could not be found." });

            //raise an 
            if (!scan.RescanRecommended || scan.RescanDays <= 0)
                return BadRequest(new { message = "This scan does not have a reminder window." });

            //Fetch the reminder
            var reminder = await _context.RescanReminders
                .FirstOrDefaultAsync(r => r.ScanId == scanId);

            // calculates when the reminder should be sent
            //dueAt = scan date + number of days AI recommended
            var dueAt = scan.ScannedAt.AddDays(scan.RescanDays);

            // save reminder , if already exists , just update it
            if (reminder == null)
            {
                reminder = new RescanReminder
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ScanId = scan.Id,
                    DueAt = dueAt,
                    IsEnabled = true,
                    EnabledAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _context.RescanReminders.Add(reminder);
            }
            else
            {
                reminder.DueAt = dueAt;
                reminder.IsEnabled = true;
                reminder.EnabledAt = DateTime.UtcNow;
                reminder.LastError = null;
            }

            //save the reminder to the db
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Reminder enabled successfully.",
                dueAt = reminder.DueAt
            });
        }

        // Return all reminder records for the authenticated user with scan summary data
        [HttpGet("reminders")]
        public async Task<IActionResult> GetReminders()
        {
            // Join reminders with scans so the frontend gets reminder timing plus scan context together.
            if (!TryGetUserId(out var userId))
                return Unauthorized(new { message = "Invalid token" });

            var user = await GetActiveUserAsync(userId);
            if (user == null) return Forbid();

            var reminders = await _context.RescanReminders
                .AsNoTracking()
                .Where(r => r.UserId == userId)
                .Join(
                    _context.Scans.AsNoTracking(),
                    reminder => reminder.ScanId,
                    scan => scan.Id,
                    (reminder, scan) => new ReminderListItemDto
                    {
                        Id = reminder.Id,
                        ScanId = scan.Id,
                        PlantAlias = scan.PlantAlias,
                        Location = scan.Location,
                        Disease = scan.DiseaseRecord == null ? null : scan.DiseaseRecord.Name,
                        RescanReason = scan.RescanReason ?? "",
                        RescanDays = scan.RescanDays,
                        ScannedAt = scan.ScannedAt,
                        DueAt = reminder.DueAt,
                        EnabledAt = reminder.EnabledAt,
                        SentAt = reminder.SentAt,
                        IsEnabled = reminder.IsEnabled,
                        LastError = reminder.LastError,
                        ImageUrl = scan.ImagePath.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                            ? scan.ImagePath
                            : $"{Request.Scheme}://{Request.Host}/{scan.ImagePath.TrimStart('/')}"
                    })
                .OrderByDescending(r => r.DueAt)
                .ToListAsync();

            return Ok(reminders);
        }
    }
}
