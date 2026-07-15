namespace fyp.DTOs
{
    public class AiDiagnoseResponseDto
    {
        public string Disease { get; set; } = "";
        public string Analysis { get; set; } = "";
        public string Solution { get; set; } = "";
        public double Confidence { get; set; }
        public string? SeverityLevel { get; set; }
        public string Provider { get; set; } = "";
        public string? Model { get; set; }
        public List<string> RecommendedProducts { get; set; } = new();
        public List<string> CareSteps { get; set; } = new();
        public string? Prevention { get; set; }

        public bool RescanRecommended { get; set; }
        public int RescanDays { get; set; }
        public string? RescanReason { get; set; }
    }
}
