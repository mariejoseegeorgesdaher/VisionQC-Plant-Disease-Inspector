using System.ComponentModel.DataAnnotations;

namespace fyp.Models
{
    public class PlantAlias
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }
        public User User { get; set; } = default!;

        [Required, MaxLength(80)]
        public string Alias { get; set; } = string.Empty;

        [MaxLength(120)]
        public string? Location { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastScannedAt { get; set; }

        public ICollection<Scan> Scans { get; set; } = new List<Scan>();
    }
}
