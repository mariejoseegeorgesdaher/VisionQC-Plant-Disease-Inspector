namespace fyp.DTOs
{
    public class DiseaseCountDto
    {
        public string Disease { get; set; } = default!;
        public int Count { get; set; }
    }

    public class LocationDiseaseStatsDto
    {
        public string Location { get; set; } = default!;
        public List<DiseaseCountDto> Diseases { get; set; } = new();
    }

    public class AdminStatsOverviewDto
    {
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int TotalScans { get; set; }
        public int ScansLast7Days { get; set; }
        public List<DiseaseCountDto> TopDiseases { get; set; } = new();
    }
}

