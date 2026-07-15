using System.ComponentModel.DataAnnotations;

namespace fyp.DTOs
{
    public class CreatePlantAliasDto
    {
        [Required, MaxLength(80)]
        public string Alias { get; set; } = default!;

        [MaxLength(120)]
        public string? Location { get; set; }
    }
}
