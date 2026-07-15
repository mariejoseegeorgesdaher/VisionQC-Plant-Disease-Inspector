using fyp.DTOs;
using fyp.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace fyp.Controllers
{

    // --------------------------------------------------------------------
    // USER MANAGEMENT
    // --------------------------------------------------------------------



    // Admin-only API for user management and analytics.
    [ApiController]
    [Route("api/v1/admin")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        // EF Core entry point for admin reads and writes.
        private readonly ApplicationDbContext _context;

        public AdminController(ApplicationDbContext context)
        {
            _context = context;
        }


        // Check what are the roles
        private static readonly HashSet<string> AllowedRoles =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Regular", "Admin" };

        private static AdminUserDto ToAdminUserDto(User user)
        {
            return new AdminUserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                IsActive = user.IsActive,
                ScanCount = user.Scans?.Count ?? 0
            };
        }

        // List users with optional filters and pagination.
        // GET: api/v1/admin/users?role=&isActive=&search=&page=1&pageSize=20
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(
            [FromQuery] string? role,
            [FromQuery] bool? isActive,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20
        )
        {
            // Clamp pagination inputs to keep queries predictable.
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 200) pageSize = 20;

            // Start from the full users set, then apply filters only when provided.
            var query = _context.Users
                .AsNoTracking()
                .AsQueryable();

            //Get roles
            if (!string.IsNullOrWhiteSpace(role))
            {
                var r = role.Trim();
                query = query.Where(u => u.Role == r);
            }
            
            //Get status value
            if (isActive.HasValue)
                query = query.Where(u => u.IsActive == isActive.Value);

            //filter email or full name
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(u =>
                    u.Email.ToLower().Contains(term) ||
                    u.FullName.ToLower().Contains(term));
            }
               
            //Equivalent SQL idea: SELECT COUNT(*) FROM Users 
            // Count first so the client can render pagination controls
            var totalCount = await query.CountAsync();

            //return items for whatever is the query
            var items = await query
                .OrderBy(u => u.FullName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new AdminUserDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role,
                    IsActive = u.IsActive,
                    ScanCount = u.Scans.Count
                })
                .ToListAsync();

            return Ok(new PagedResult<AdminUserDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            });
        }

        // Create a local user account from the admin panel.
        // POST: api/v1/admin/users
        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            var fullName = dto.FullName.Trim();
            var email = dto.Email.Trim().ToLower();
            var role = string.IsNullOrWhiteSpace(dto.Role) ? "Regular" : dto.Role.Trim();

            if (!AllowedRoles.Contains(role))
                return BadRequest(new { message = "Invalid role. Allowed: Regular, Admin" });

            var emailExists = await _context.Users.AnyAsync(u => u.Email.ToLower() == email);
            if (emailExists)
                return Conflict(new { message = "A user with this email already exists" });

            var user = new User
            {
                Id = Guid.NewGuid(),
                FullName = fullName,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = role,
                IsActive = true,
                AuthProvider = "Local"
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, ToAdminUserDto(user));
        }

        // Return one user summary by id.
        // GET: api/v1/admin/users/{id}
        [HttpGet("users/{id:guid}")]
        public async Task<IActionResult> GetUser(Guid id)
        {
         
            var user = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new AdminUserDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role,
                    IsActive = u.IsActive,
                    ScanCount = u.Scans.Count
                })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound(new { message = "User not found" });
            return Ok(user);
        }

        // Update user's profile fields and/or password.
        // PUT: api/v1/admin/users/{id}
        [HttpPut("users/{id:guid}")]
        public async Task<IActionResult> EditUser(Guid id, [FromBody] EditUserDto dto)
        {
            // Fetch user in the db
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            //change full name
            if (!string.IsNullOrWhiteSpace(dto.FullName))
                user.FullName = dto.FullName.Trim();

            //change password
            if (!string.IsNullOrWhiteSpace(dto.NewPassword))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

            //save changes
            await _context.SaveChangesAsync();

            return Ok(new { message = "User updated successfully" });
        }

        // Permanently delete a user and their owned data.
        // DELETE: api/v1/admin/users/{id}
        [HttpDelete("users/{id:guid}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var currentUserId =
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
                User.FindFirstValue("sub");

            if (Guid.TryParse(currentUserId, out var currentAdminId) && currentAdminId == id)
                return BadRequest(new { message = "You cannot delete your own admin account" });

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User deleted successfully" });
        }

        // Update a user's role (Regular/Admin) when click on the icon
        // PATCH: api/v1/admin/users/{id}/role
        [HttpPatch("users/{id:guid}/role")]
        public async Task<IActionResult> ChangeRole(Guid id, [FromBody] ChangeRoleDto dto)
        {
            // Fetch user in the db
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            //additional backend validation
            if (!AllowedRoles.Contains(dto.Role))
                return BadRequest(new { message = "Invalid role. Allowed: Regular, Admin" });

            //change role
            user.Role = dto.Role;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Role updated successfully" });
        }

        // Mark a user as active.
        // PATCH: api/v1/admin/users/{id}/activate
        [HttpPatch("users/{id:guid}/activate")]
        public async Task<IActionResult> ActivateUser(Guid id)
        {
            //Fetch user from the db
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            //activate user 
            user.IsActive = true;
            //save changes
            await _context.SaveChangesAsync();

            return Ok(new { message = "User activated successfully" });
        }

        // Mark a user as inactive.
        // PATCH: api/v1/admin/users/{id}/deactivate
        [HttpPatch("users/{id:guid}/deactivate")]
        public async Task<IActionResult> DeactivateUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            //desactivate user
            user.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "User deactivated successfully" });
        }

        // --------------------------------------------------------------------
        // STATISTICS
        // --------------------------------------------------------------------

        // Top Diseases , Total scans , Total users , Total active users
        // GET: api/v1/admin/stats/overview?top=5
        [HttpGet("stats/overview")]
        public async Task<IActionResult> GetStatsOverview([FromQuery] int top = 5)
        {
            // take first 5 diseases
            if (top < 1 || top > 50) top = 5;

            // calculate some values
            var totalUsers = await _context.Users.CountAsync();
            var activeUsers = await _context.Users.CountAsync(u => u.IsActive);
            var totalScans = await _context.Scans.CountAsync();

            var since = DateTime.UtcNow.AddDays(-7);
            var scansLast7Days = await _context.Scans.CountAsync(s => s.ScannedAt >= since);

            // Rank disease by number of scans
            var topDiseases = await _context.Scans
                .AsNoTracking()
                .Where(s => s.DiseaseRecord != null)
                .GroupBy(s => s.DiseaseRecord!.Name)
                .Select(g => new DiseaseCountDto
                {
                    Disease = g.Key,
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Disease)
                .Take(top)
                .ToListAsync();

            var dto = new AdminStatsOverviewDto
            {
                TotalUsers = totalUsers,
                ActiveUsers = activeUsers,
                TotalScans = totalScans,
                ScansLast7Days = scansLast7Days,
                TopDiseases = topDiseases
            };

            return Ok(dto);
        }

        // Return disease distribution grouped by location.
        // GET: api/v1/admin/stats/diseases-by-location
        [HttpGet("stats/diseases-by-location")]
        public async Task<IActionResult> GetDiseasesByLocation()
        {
            // Aggregate raw scan counts by location+disease in SQL first
            var raw = await _context.Scans
                .AsNoTracking()
                .Where(s =>
                    s.Location != null && s.Location != "" &&
                    s.DiseaseRecord != null)
                .GroupBy(s => new { Location = s.Location!, Disease = s.DiseaseRecord!.Name })
                .Select(g => new
                {
                    g.Key.Location,
                    g.Key.Disease,
                    Count = g.Count()
                })
                .ToListAsync();

            // Reshape the flat grouped rows into the nested DTO expected by the frontend.
            var result = raw
                //In this location
                .GroupBy(x => x.Location)
                //select the highest disease
                .Select(g => new LocationDiseaseStatsDto
                {
                    Location = g.Key,
                    Diseases = g
                        .OrderByDescending(x => x.Count)
                        .ThenBy(x => x.Disease)
                        .Select(x => new DiseaseCountDto { Disease = x.Disease, Count = x.Count })
                        .ToList()
                })
                .OrderBy(x => x.Location)
                .ToList();

            return Ok(result);
        }

    }
}
