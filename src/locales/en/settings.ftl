# Settings

# Settings menu
settings-title = ⚙️ Settings
settings-language = 🌍 Language
settings-timezone = 🌐 Timezone
settings-digest = 📬 Daily Digest Times
settings-reminder = ⏰ Progress Reminder

# Language settings
language-title = 🌍 Language Settings
language-current = Current language: { $language }
language-select = Select language:
language-updated = Language updated to { $language }

# Timezone settings
timezone-title = 🌐 Timezone Settings
timezone-current = Current timezone: { $timezone }
timezone-updated = Timezone updated to { $timezone }

# Digest settings
digest-title = 📬 Daily Digest Settings
digest-current = Current digest times: { $times ->
    [none] Not set
   *[other] { $times }
  }
digest-add = ➕ Add Time
digest-remove = 🗑️ Remove Time
digest-prompt = Enter time for daily digest (HH:mm, e.g., 09:00):
digest-added = Digest time added: { $time }
digest-removed = Digest time removed
digest-max = You already have 3 digest times (maximum)

# Reminder settings
reminder-title = ⏰ Progress Reminder Settings
reminder-current = Current reminder time: { $time ->
    [none] Not set
   *[other] { $time }
  }
reminder-set-btn = ⏰ Set Time
reminder-remove-btn = 🗑️ Remove
reminder-prompt = Enter time for progress reminder (HH:mm, e.g., 20:00):
reminder-updated = Progress reminder set to { $time }
reminder-removed = Progress reminder removed

# Keyboard buttons
btn-language = 🌐 Language
btn-timezone = 🌍 Timezone
btn-digest-reminders = 📋 Digest Reminders
btn-progress-reminder = 📝 Progress Reminder
btn-reset-all = 🗑 Reset All Data
btn-back = ← Back
btn-other-custom = 📝 Other (type manually)
btn-custom = 📝 Custom
btn-disable = 🚫 Disable
btn-add-time = ➕ Add Time
btn-clear-all = 🗑 Clear All
btn-cancel = ← Cancel
btn-confirm = ✅ Confirm

# Reset confirmation
reset-title = 🗑 Reset All Data
reset-warning = ⚠️ This will permanently delete all your data including:
reset-warning-areas = • All focus areas
reset-warning-progress = • All progress entries
reset-warning-settings = • All settings
reset-confirm-step1 = ⚠️ Yes, I understand
reset-confirm-step2 = 🚨 DELETE EVERYTHING
reset-success = All data has been deleted. Use /start to begin again.

# Timezone custom input
timezone-custom-prompt = Enter your timezone (e.g., America/New_York):
timezone-invalid = Invalid timezone. Please try again.

# Digest times management
digest-cleared = All digest times cleared

# Error messages
error-please-start = Please start the bot first with /start
