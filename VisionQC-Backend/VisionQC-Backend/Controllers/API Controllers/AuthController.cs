using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using fyp.DTOs;
using fyp.Models;
using fyp.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Google.Apis.Auth;

namespace fyp.Controllers
{
    // Public auth API: login/register, password reset, and Google sign-in.
    [ApiController]
    [Route("api/v1/auth")]
    public class AuthController : ControllerBase
    {
  
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;
        private readonly IWebHostEnvironment _env;

        public AuthController(ApplicationDbContext context, IConfiguration config, IEmailService emailService, IWebHostEnvironment env)
        {
            _context = context;
            _config = config;
            _emailService = emailService;
            _env = env;
        }



        // Authenticate with email/password and return JWT.
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
        {

            try
            {
                // Reject malformed payloads before doing any database work.
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                // Normalize the incoming credentials so comparisons are consistent.
                var email = dto?.Email?.Trim().ToLower();
                var password = dto?.Password;

                //This check is a second safety check 
                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
                {
                    return BadRequest(new { message = "Email or password missing" });
                }

                // Find the account by email
                //FirstOrDefaultAsync is replace to a query
                //SELECT *
                // FROM "Users"
                // WHERE LOWER("Email") = @email
                // LIMIT 1;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

                if (user == null)
                    //Unauthorized return a 401 Unauthorized error
                    return Unauthorized(new { message = "Invalid email or password" });

                // Password login is blocked for Google-only accounts.
                if (string.IsNullOrEmpty(user.PasswordHash))
                    return Unauthorized(new { message = "This account uses Google sign-in." });

                if (!user.IsActive)
                    return Unauthorized(new { message = "Account is deactivated" });

                // BCrypt can throw if the stored hash is invalid, so keep the response generic.
                bool passwordOk;
                try
                {
                    passwordOk = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
                }
                catch
                {
                    return Unauthorized(new { message = "Invalid email or password" });
                }

                if (!passwordOk)
                    return Unauthorized(new { message = "Invalid email or password" });

                //set a safe default.
                if (string.IsNullOrWhiteSpace(user.Role))
                    user.Role = "Regular";
                //for validation not related to user such as manual database edit, bad migration
                //the user can exists but the mail is empty/null/invalid
                if (string.IsNullOrWhiteSpace(user.Email))
                    return StatusCode(500, new { message = "Account data is invalid: missing email." });

                // Build the signed JWT returned to the client for future authenticated calls.
                var token = GenerateJwtToken(user);

                return Ok(new LoginResponseDto
                {
                    Token = token,
                    UserId = user.Id,
                    Email = user.Email,
                    Role = user.Role
                });
            }
            //catch errors like
            //database connection is down
            // PostgreSQL query fails
            // Jwt:Key is missing from appsettings.json
            // JWT creation fails
            // BCrypt library throws unexpectedly
            // configuration problem
            // server/internal bug
              catch (Exception ex)
            {
                if (_env.IsDevelopment())
                    return StatusCode(500, new { message = "Login failed.", error = ex.Message });

                return StatusCode(500, new { message = "Login failed." });
            }
        }

        // Create a new Regular user account with hashed password.
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Normalize email before uniqueness checks and storage.
            var email = dto.Email.Trim().ToLower();

            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
                // returns a HTTP 409 status
                return Conflict(new { message = "Email already exists" });

            // Store only the hashed password, never the raw password.
            var user = new User
            {
                FullName = dto.FullName,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = "Regular"
            };
            //Prepare to insert this user
            _context.Users.Add(user);
            //actually sends the SQL to the database
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Registration successful"
            });
        }

        // Send password reset link if account exists 
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Use the same generic response whether the email exists or not.
            var email = dto.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            // generic response for security
            if (user == null)
                return Ok(new { message = "If the email exists, a reset link was sent." });

            // Read the web reset destination from configuration.
            var webBaseUrl = _config["Frontend:ResetPasswordUrl"];
            if (string.IsNullOrWhiteSpace(webBaseUrl))
                return StatusCode(500, new { message = "Frontend:ResetPasswordUrl is not configured." });

            // Generate a random token, but store only its hash in the database
            //The person resetting the password is the same person who received the email
            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

            user.PasswordResetTokenHash = BCrypt.Net.BCrypt.HashPassword(rawToken);
            //link expiry time (15 minute)
            user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(15);
            await _context.SaveChangesAsync();

            //sending the link with the token
            var query = $"email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(rawToken)}";
            var resetLink = $"{webBaseUrl}?{query}";

            // Send the reset link through the email service.
            try
            {
                //actually sending the mail
                //SendPasswordResetEmailAsync of SmtpEmailService
                await _emailService.SendPasswordResetEmailAsync(user.Email, resetLink);
            }
            catch (Exception ex)
            {
                   // Possible cases : 
                        //SMTP password wrong
                        // Gmail blocks the login
                        // internet/network issue
                        // SMTP host/port wrong
                        // recipient email invalid
                        // Gmail SMTP unavailable
                if (_env.IsDevelopment())
                    return StatusCode(500, new { message = "Failed to send reset email.", error = ex.Message, devResetLink = resetLink });

                return StatusCode(500, new { message = "Failed to send reset email." });
            }

            if (_env.IsDevelopment())
            {
                return Ok(new
                {
                    message = "If the email exists, a reset link was sent.",
                    devResetLink = resetLink
                });
            }

            return Ok(new { message = "If the email exists, a reset link was sent." });
        }



        // Validate reset token and set a new password
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Look up the user and validate that a reset flow is still active.
            var email = dto.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
                return BadRequest(new { message = "Invalid reset request" });

            if (string.IsNullOrEmpty(user.PasswordResetTokenHash) || user.PasswordResetTokenExpiresAt == null)
                return BadRequest(new { message = "Invalid reset request" });

            if (user.PasswordResetTokenExpiresAt < DateTime.UtcNow)
                return BadRequest(new { message = "Reset token expired" });

            // Compare the provided reset token against the stored hash to make sure the user that requested the forgot password is the same that received the mail
            var incomingToken = Uri.UnescapeDataString(dto.Token);
            var tokenOk = BCrypt.Net.BCrypt.Verify(incomingToken, user.PasswordResetTokenHash);

            if (!tokenOk)
                return BadRequest(new { message = "Invalid reset token" });

            // Replace the password and clear the reset token so it cannot be reused
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.PasswordResetTokenHash = null;
            user.PasswordResetTokenExpiresAt = null;

            //same the password
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password reset successful" });
        }


        // Stateless logout endpoint (client-side token removal)
        //Stateless JWT means its not stored in the db , only in the local storage in the front end
        //So the web and teh mobile delete the token variable
        //Web for example: 
        //await api.post("/auth/logout");
        // localStorage.removeItem("token");

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            // Stateless JWT: le client supprime le token
            return Ok(new { message = "Logged out" });
        }

        // Build application JWT from user identity.
        private string GenerateJwtToken(User user)
        {
            // Get the secret Key from appSettings
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new Exception("Jwt:Key is not configured.");

            //convert the key to bytes
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            //assigning the key and algorithm to the signing credentials that will be used to sign the JWT
            // ka2ano 3am men oul sta3moul hayde el key w hayda el algorithm bel signature
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // creating the payload
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };

            //creating a JwtSecurityToken object
            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds
            );
            //that we be later converted into a token
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // Sign in an existing user with a Google identity token.
        [HttpPost("google/login")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleSignInRequestDto dto)
        {
            //Validate request body of the dto given as parameter
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.IdToken))
                return BadRequest(new { message = "IdToken is required" });

            // Load the allowed Google client ids that this backend trusts from appSettings
            var audiences = _config.GetSection("Authentication:Google:ClientIds")
                .Get<string[]>()?
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .ToArray();
            //if no client id return this error
            if (audiences == null || audiences.Length == 0)
                return StatusCode(500, new { message = "Google ClientId(s) is not configured." });

            // This asks Google’s library to verify the token 
            //Is this token real?
            // Is it expired?
            // Was it created for one of our Google Client IDs?
            GoogleJsonWebSignature.Payload payload;
            try
            {
                //The variable is named payload because the result we get back is the payload/user info
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    dto.IdToken,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = audiences
                    }
                );
            }
            //If invalid
            catch (Exception ex)
            {
                if (_env.IsDevelopment())
                    return Unauthorized(new { message = "Invalid Google token", error = ex.Message });

                return Unauthorized(new { message = "Invalid Google token" });
            }

            var googleId = payload.Subject;
            var email = (payload.Email ?? "").Trim().ToLower();
            

            if (string.IsNullOrWhiteSpace(googleId))
                return Unauthorized(new { message = "Invalid Google token payload." });

            // First try to match the user by Google subject id
            var user = await _context.Users.FirstOrDefaultAsync(u => u.GoogleId == googleId);

            if (user == null && !string.IsNullOrWhiteSpace(email))
            {
                // If a user exists with the same email but no Google link, block auto-merge.
                var existingByEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
                if (existingByEmail != null)
                {
                    //if email found but no googleId that means the user is registered the registration form not google
                    //so say this to the user
                    if (string.IsNullOrWhiteSpace(existingByEmail.GoogleId))
                        return Conflict(new { message = "This email already exists as a password account. Please sign in with email and password." });

                    user = existingByEmail;
                }
            }

            if (user == null)
                return Unauthorized(new { message = "No Google account found. Please register first." });

            if (!user.IsActive)
                return Unauthorized(new { message = "Account is deactivated" });

            if (string.IsNullOrWhiteSpace(user.Role))
            {
                user.Role = "Regular";
                await _context.SaveChangesAsync();
            }

            if (string.IsNullOrWhiteSpace(user.Email))
                return StatusCode(500, new { message = "Account data is invalid: missing email." });

            // create a jwt else than the google one
            //because the google one is only used for verifying the account , it does not contain the user role /userId of or db
            var token = GenerateJwtToken(user);

            return Ok(new LoginResponseDto
            {
                Token = token,
                UserId = user.Id,
                Email = user.Email,
                Role = user.Role
            });
        }


        // Create a new account from a valid Google identity token.
        [HttpPost("google/register")]
        public async Task<IActionResult> GoogleRegister([FromBody] GoogleSignInRequestDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.IdToken))
                return BadRequest(new { message = "IdToken is required" });

            var audiences = _config.GetSection("Authentication:Google:ClientIds")
                .Get<string[]>()?
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .ToArray();

            if (audiences == null || audiences.Length == 0)
                return StatusCode(500, new { message = "Google ClientId(s) is not configured." });

            // Validate that 
                // Is this Google token real?
                // Was it issued by Google?
                // Is it not expired?
                // Was it created for one of our allowed Google Client IDs?
            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    dto.IdToken,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = audiences
                    }
                );
            }
            catch (Exception ex)
            {
                if (_env.IsDevelopment())
                    return Unauthorized(new { message = "Invalid Google token", error = ex.Message });

                return Unauthorized(new { message = "Invalid Google token" });
            }

            var email = (payload.Email ?? "").Trim().ToLower();
            var googleId = payload.Subject;

            if (string.IsNullOrWhiteSpace(googleId))
                return Unauthorized(new { message = "Invalid Google token payload." });

            if (string.IsNullOrWhiteSpace(email))
                return Unauthorized(new { message = "Google token has no email." });

            // Prevent duplicates by both Google id and email address.
            var existingByGoogleId = await _context.Users.FirstOrDefaultAsync(u => u.GoogleId == googleId);
            if (existingByGoogleId != null)
                return Conflict(new { message = "A Google account already exists. Please sign in instead." });

            var existingByEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (existingByEmail != null)
                return Conflict(new { message = "Email already exists. Please sign in instead." });

            // Create a local user record linked to the Google account.
            var user = new User
            {
                FullName = payload.Name ?? "Google User",
                Email = email,
                PasswordHash = null,
                Role = "Regular",
                AuthProvider = "Google",
                GoogleId = googleId,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);

            return Ok(new LoginResponseDto
            {
                Token = token,
                UserId = user.Id,
                Email = user.Email,
                Role = user.Role
            });
        }

    }
}
