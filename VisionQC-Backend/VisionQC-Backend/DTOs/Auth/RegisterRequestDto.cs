using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace fyp.DTOs
{

    public class RegisterRequestDto
    {
        [Required]
        [MinLength(3)]
        [JsonPropertyName("fullName")]
        public string FullName { get; set; }

        [Required]
        [EmailAddress]
        [JsonPropertyName("email")]
        public string Email { get; set; }

        [Required]
        [MinLength(4)]
        [JsonPropertyName("password")]
        public string Password { get; set; }

        public RegisterRequestDto(string fullName, string email, string password) { FullName = fullName; Email = email; Password = password; }
    }

}
