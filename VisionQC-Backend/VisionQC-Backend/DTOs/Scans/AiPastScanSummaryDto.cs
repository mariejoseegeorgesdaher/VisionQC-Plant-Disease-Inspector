using System.Text.Json.Serialization;

namespace fyp.DTOs
{
    public class AiPastScanSummaryDto
    {
        [JsonPropertyName("scannedAt")]
        public string ScannedAt { get; set; } = "";

        [JsonPropertyName("disease")]
        public string Disease { get; set; } = "";

        [JsonPropertyName("confidence")]
        public double? Confidence { get; set; }

        [JsonPropertyName("analysis")]
        public string Analysis { get; set; } = "";

        [JsonPropertyName("solution")]
        public string Solution { get; set; } = "";

        [JsonPropertyName("prevention")]
        public string Prevention { get; set; } = "";
    }
}
