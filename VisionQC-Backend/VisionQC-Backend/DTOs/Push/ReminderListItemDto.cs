namespace fyp.DTOs
{
    public class ReminderListItemDto
    {
        public Guid Id { get; set; }
        public Guid ScanId { get; set; }
        public string PlantAlias { get; set; } = default!;
        public string? Location { get; set; }
        public string? Disease { get; set; }
        public string RescanReason { get; set; } = "";
        public int RescanDays { get; set; }
        public DateTime ScannedAt { get; set; }
        public DateTime DueAt { get; set; }
        public DateTime? EnabledAt { get; set; }
        public DateTime? SentAt { get; set; }
        public bool IsEnabled { get; set; }
        public string? LastError { get; set; }
        public string ImageUrl { get; set; } = default!;
    }
}
