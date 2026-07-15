using System.Text.Json;
using fyp.Settings;
using Microsoft.Extensions.Options;
using WebPush;

namespace fyp.Services
{
    public class WebPushService : IWebPushService
    {
        private readonly ILogger<WebPushService> _logger;
        private readonly VapidDetails _vapidDetails;
        private readonly string _publicKey;
        private readonly WebPushClient _client = new();

        public WebPushService(IOptions<WebPushSettings> options, ILogger<WebPushService> logger)
        {
            _logger = logger;
            var settings = options.Value;

            if (string.IsNullOrWhiteSpace(settings.PublicKey) || string.IsNullOrWhiteSpace(settings.PrivateKey))
            {
                var generatedKeys = VapidHelper.GenerateVapidKeys();
                settings.PublicKey = generatedKeys.PublicKey;
                settings.PrivateKey = generatedKeys.PrivateKey;
                _logger.LogWarning("Web push VAPID keys are missing from configuration. Generated temporary development keys for this process only.");
            }

            _publicKey = settings.PublicKey;
            _vapidDetails = new VapidDetails(settings.Subject, settings.PublicKey, settings.PrivateKey);
        }

        public string GetPublicKey() => _publicKey;

        //Sends Push Notification
        public async Task SendReminderAsync(fyp.Models.PushSubscription subscription, fyp.Models.RescanReminder reminder, CancellationToken cancellationToken)
        {
            //Serializing the payload to a json
            var payload = JsonSerializer.Serialize(new
            {
                title = $"Re-scan reminder for {reminder.Scan.PlantAlias}",
                body = string.IsNullOrWhiteSpace(reminder.Scan.RescanReason)
                    ? $"It's time to re-scan {reminder.Scan.PlantAlias}."
                    : $"It's time to re-scan {reminder.Scan.PlantAlias}. {reminder.Scan.RescanReason}",
                url = "/",
                tag = $"visionqc-reminder-{reminder.ScanId}"
            });
            
            //creating the push notification
            var webPushSubscription = new WebPush.PushSubscription(
                subscription.Endpoint,
                subscription.P256dh,
                subscription.Auth);
                
            //cancel the notification
            cancellationToken.ThrowIfCancellationRequested();
            //send the notification
            await _client.SendNotificationAsync(webPushSubscription, payload, _vapidDetails);
        }
    }
}
