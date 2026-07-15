using System.ComponentModel.DataAnnotations;

namespace fyp.DTOs
{
    public class PushSubscriptionDto
    {
        [Required]
        public string Endpoint { get; set; } = string.Empty;

        [Required]
        public PushSubscriptionKeysDto Keys { get; set; } = new();
    }

    public class PushSubscriptionKeysDto
    {
        [Required]
        public string P256dh { get; set; } = string.Empty;

        [Required]
        public string Auth { get; set; } = string.Empty;
    }
}
