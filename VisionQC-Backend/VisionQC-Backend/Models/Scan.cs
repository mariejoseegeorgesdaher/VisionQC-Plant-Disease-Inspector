using System.ComponentModel.DataAnnotations;

namespace fyp.Models
{
    public class Scan
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid UserId { get; set; }
        public User User { get; set; } = default!;

        public Guid? PlantAliasId { get; set; }
        public PlantAlias? PlantAliasRecord { get; set; }

        [Required, MaxLength(80)]
        public string PlantAlias { get; set; } = default!;

        [MaxLength(120)]
        public string? Location { get; set; }

        [Required, MaxLength(300)]
        public string ImagePath { get; set; } = default!;

        public DateTime ScannedAt { get; set; } = DateTime.UtcNow;

        public Guid? DiseaseId { get; set; }
        public Disease? DiseaseRecord { get; set; }

        public double? Confidence { get; set; }
        [MaxLength(40)]
        public string? SeverityLevel { get; set; }
        public string? Analysis { get; set; }
        public string? Solution { get; set; }
        public string? RecommendedProducts { get; set; }
        public string? CareSteps { get; set; }
        public string? Prevention { get; set; }

        public bool RescanRecommended { get; set; }
        public int RescanDays { get; set; }
        public string? RescanReason { get; set; }
    }
}
