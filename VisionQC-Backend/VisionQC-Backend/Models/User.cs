using System.Collections.Generic;

namespace fyp.Models
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PasswordHash { get; set; }
        public string Role { get; set; } = "Regular";
        public bool IsActive { get; set; } = true;
        public string? GoogleId { get; set; }
        public string AuthProvider { get; set; } = "Local";
        public string? PasswordResetTokenHash { get; set; }
        public DateTime? PasswordResetTokenExpiresAt { get; set; }
        public ICollection<Scan> Scans { get; set; } = new List<Scan>();
        public ICollection<PlantAlias> PlantAliases { get; set; } = new List<PlantAlias>();
        public ICollection<PushSubscription> PushSubscriptions { get; set; } = new List<PushSubscription>();
        public ICollection<RescanReminder> RescanReminders { get; set; } = new List<RescanReminder>();
    }
}
