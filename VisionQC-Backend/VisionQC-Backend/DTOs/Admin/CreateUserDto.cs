using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace fyp.DTOs
{
    public class CreateUserDto
    {
        [Required]
        [MinLength(3)]
        [JsonPropertyName("fullName")]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(4)]
        [JsonPropertyName("password")]
        public string Password { get; set; } = string.Empty;

        [JsonPropertyName("role")]
        public string Role { get; set; } = "Regular";
    }
}
