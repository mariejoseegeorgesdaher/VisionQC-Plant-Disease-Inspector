namespace fyp.DTOs
{
    public class ScanListItemDto
    {
        public Guid Id { get; set; }
        public string PlantAlias { get; set; } = default!;
        public string? Location { get; set; }
        public DateTime ScannedAt { get; set; }
        public string? Disease { get; set; }
        public double? Confidence { get; set; }
        public string? SeverityLevel { get; set; }
        public bool RescanRecommended { get; set; }
        public int RescanDays { get; set; }
        public string RescanReason { get; set; } = "";
        public string? Analysis { get; set; }
        public string? Solution { get; set; }
        public string ImageUrl { get; set; } = default!;
    }
}
