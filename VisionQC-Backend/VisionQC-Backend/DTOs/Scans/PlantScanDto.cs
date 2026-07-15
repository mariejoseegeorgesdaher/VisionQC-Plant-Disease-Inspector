using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace fyp.DTOs
{
    public class PlantScanDto
    {
        [Required]
        public IFormFile Image { get; set; } = default!;

        [Required, MaxLength(80)]
        public string Alias { get; set; } = default!;

        [MaxLength(120)]
        public string? Location { get; set; }

        public string? Disease { get; set; }
        public string? Analysis { get; set; }
        public string? Solution { get; set; }
        public double? Confidence { get; set; }
        [MaxLength(40)]
        public string? Provider { get; set; }
        [MaxLength(120)]
        public string? Model { get; set; }
    }
}
