using System.ComponentModel.DataAnnotations;

namespace fyp.DTOs
{
    public class EditMyProfileDto
    {
        [MaxLength(120)]
        public string? FullName { get; set; }
    }
}
