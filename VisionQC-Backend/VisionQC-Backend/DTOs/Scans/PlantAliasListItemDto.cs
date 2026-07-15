namespace fyp.DTOs
{
    public class PlantAliasListItemDto
    {
        public Guid Id { get; set; }
        public string Alias { get; set; } = default!;
        public string? Location { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastScannedAt { get; set; }
        public int ScanCount { get; set; }
        public Guid? LatestScanId { get; set; }
        public string? LatestDisease { get; set; }
        public string? LatestAnalysis { get; set; }
        public string? LatestSolution { get; set; }
        public string? LatestImageUrl { get; set; }
    }
}
