using System.ComponentModel.DataAnnotations;

namespace fyp.Models
{
    public class RescanReminder
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid UserId { get; set; }
        public User User { get; set; } = default!;

        [Required]
        public Guid ScanId { get; set; }
        public Scan Scan { get; set; } = default!;

        public DateTime DueAt { get; set; }
        public bool IsEnabled { get; set; }
        public DateTime? EnabledAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? SentAt { get; set; }
        public string? LastError { get; set; }
    }
}
