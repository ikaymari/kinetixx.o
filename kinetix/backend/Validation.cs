using System.Net.Mail;

namespace KinetixCart;

static class KinetixValidation
{
    private static readonly HashSet<string> RegistrationEvents = new(StringComparer.Ordinal)
    {
        "PE Days", "College Days", "Seminar", "Workshop", "Officiating"
    };

    private static readonly HashSet<string> RegistrationCategories = new(StringComparer.Ordinal)
    {
        "Participant", "Player", "Audience", "Volunteer"
    };

    public static bool TryValidateAnnouncement(SaveAnnouncementRequest request, out string error)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 120)
        {
            error = "Enter an announcement title of 1 to 120 characters.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Trim().Length > 2000)
        {
            error = "Enter announcement text of 1 to 2,000 characters.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    public static bool TryValidateRegistration(EventRegistrationRequest request, out string error)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 120)
        {
            error = "Enter a name of 1 to 120 characters.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Trim().Length > 254 ||
            !MailAddress.TryCreate(request.Email.Trim(), out var address) ||
            !string.Equals(address.Address, request.Email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            error = "Enter a valid email address.";
            return false;
        }

        var phone = request.Phone?.Trim();
        if (string.IsNullOrWhiteSpace(phone) || phone.Length > 40 ||
            phone.Any(character => !char.IsDigit(character) && character is not '+' and not '-' and not '(' and not ')' and not ' ') ||
            phone.Count(char.IsDigit) < 7)
        {
            error = "Enter a valid contact number with at least 7 digits.";
            return false;
        }

        if (request.School?.Trim().Length > 160)
        {
            error = "School or organization must be 160 characters or fewer.";
            return false;
        }

        if (request.Event is null || !RegistrationEvents.Contains(request.Event))
        {
            error = "Choose a valid event.";
            return false;
        }

        if (request.Category is null || !RegistrationCategories.Contains(request.Category))
        {
            error = "Choose a valid category.";
            return false;
        }

        error = string.Empty;
        return true;
    }
}
