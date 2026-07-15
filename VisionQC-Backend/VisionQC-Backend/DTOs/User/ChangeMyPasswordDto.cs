using System.ComponentModel.DataAnnotations;

namespace fyp.DTOs
{
    public class ChangeMyPasswordDto
    {
        [Required]
        public string OldPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(4)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
