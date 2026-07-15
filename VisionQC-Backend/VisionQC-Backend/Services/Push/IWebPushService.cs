using fyp.Models;

namespace fyp.Services
{
    public interface IWebPushService
    {
        string GetPublicKey();
        Task SendReminderAsync(PushSubscription subscription, RescanReminder reminder, CancellationToken cancellationToken);
    }
}
