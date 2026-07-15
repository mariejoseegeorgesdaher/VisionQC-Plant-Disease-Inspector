using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
namespace fyp.DTOs
{


    public class LoginRequestDto
    {
        [Required]
        [EmailAddress]
        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(4)]
        [JsonPropertyName("password")]
        public string Password { get; set; } = string.Empty;
    }

}
