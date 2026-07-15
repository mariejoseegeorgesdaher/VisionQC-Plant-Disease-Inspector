namespace fyp.Models
{
    public class Disease
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        //navigation property
        //It does not create a Scans column inside the Diseases table
        //It means that Each disease can have many scans (n)
        public ICollection<Scan> Scans { get; set; } = new List<Scan>();
    }
}
