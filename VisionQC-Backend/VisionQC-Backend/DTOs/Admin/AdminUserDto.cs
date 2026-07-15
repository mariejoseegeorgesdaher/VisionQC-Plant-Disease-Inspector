namespace fyp.DTOs
{
    public class AdminUserDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = default!;
        public string Email { get; set; } = default!;
        public string Role { get; set; } = default!;
        public bool IsActive { get; set; }
        public int ScanCount { get; set; }
    }
}
