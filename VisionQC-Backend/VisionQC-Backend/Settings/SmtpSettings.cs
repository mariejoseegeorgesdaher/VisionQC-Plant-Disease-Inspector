namespace fyp.Settings
{
    public class SmtpSettings
    {
        public string Host { get; set; } = default!;
        public int Port { get; set; }
        public bool EnableSsl { get; set; } = true;

        public string FromEmail { get; set; } = default!;
        public string FromName { get; set; } = "VisionQC";

        public string Username { get; set; } = default!;
        public string Password { get; set; } = default!;
    }
}
