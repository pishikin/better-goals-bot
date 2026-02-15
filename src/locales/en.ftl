# Focus areas management

# List areas
areas-title = 🎯 Your Focus Areas
areas-empty = You don't have any focus areas yet. Add your first one!
areas-list-item = { $position }. { $emoji } { $title }{ $body ->
    [none] {""}
   *[other] {"\n"}   → { $body }
  }

# Add area
add-area-start = Let's add a new focus area! 💡
add-area-title-prompt = Enter the area title (max 50 characters):
add-area-body-prompt = 
  Great title! 
  
  Now add a description (optional, max 200 characters).
  Type /skip to skip.
add-area-emoji-prompt = 
  Add an emoji for this area (optional).
  
  Examples: 💼 🏃 📚 👨‍👩‍👧 💰
  
  Type /skip to skip.
add-area-success = 
  Focus area added! ✅
  
  { $emoji } { $title }{ $body ->
    [none] {""}
   *[other] {"\n"}→ { $body }
  }

# Edit area
edit-area-select = Select an area to edit:
edit-area-what = What would you like to edit?
edit-area-title = ✏️ Edit Title
edit-area-body = 📝 Edit Description
edit-area-emoji = 🎨 Edit Emoji
edit-area-title-prompt = Enter new title (max 50 characters):
edit-area-body-prompt = Enter new description (max 200 characters) or /remove to remove:
edit-area-emoji-prompt = Enter new emoji or /remove to remove:
edit-area-updated = Area updated successfully! ✅

# Delete area
delete-area-select = Select an area to delete:
delete-area-confirm = 
  Delete "{ $title }"?
  
  ⚠️ All progress history for this area will be permanently deleted.
delete-area-deleted = Area "{ $title }" has been deleted.

# Actions and messages
areas-no-areas-to-edit = No areas to edit. Add some first!
areas-select-to-edit = Select an area to edit:
areas-what-to-do = What would you like to do?
areas-deleted-success = Area deleted.
areas-deleted-no-remaining = Area deleted.

No areas remaining.
areas-remaining = Remaining areas:
areas-edit-coming-soon = Edit functionality coming soon...

# Error messages
error-please-start = Please start the bot first with /start
error-area-not-found = Area not found
error-access-denied = Access denied
# Common phrases, buttons, errors

# Buttons
btn-log-progress = 📝 Log Progress
btn-add-area = ➕ Add Area
btn-edit = ✏️ Edit
btn-settings = ⚙️ Settings
btn-cancel = ❌ Cancel
btn-skip = ⏭️ Skip
btn-back = ← Back
btn-delete = 🗑 Delete
btn-confirm-delete = 🗑 Yes, delete
btn-done = ✅ Done
btn-generate-summary = 🤖 Generate AI Prompt
btn-help = ❓ Help
btn-cancel-all = 🚫 Cancel All
btn-edit-areas = ✏️ Edit Areas
btn-skip-no-description = ⏭ Skip (no description)
btn-skip-no-emoji = ⏭ Skip (no emoji)
btn-add-another = ➕ Add another ({ $remaining } left)
btn-done-continue = ✅ Done, continue
btn-edit-title = 📝 Title
btn-edit-description = 📄 Description
btn-edit-emoji = 😀 Emoji
btn-today = 📅 Today
btn-past-period = 📆 Past Period
btn-custom-date = 📝 Enter Date

# Validation errors
error-area-title-required = Area title is required
error-area-title-too-long = Area title must not exceed 50 characters
error-area-body-too-long = Area description must not exceed 200 characters
error-progress-too-long = Progress entry must not exceed 200 characters
error-max-areas = You have reached the maximum limit of 7 focus areas
error-invalid-time = Invalid time format. Please use HH:mm (e.g., 09:00)
error-invalid-timezone = Invalid timezone
error-invalid-emoji = Invalid emoji. Please send a single emoji character
error-invalid-date = Date is invalid or too far. Use DD.MM.YY format (e.g., 01.02.26). Date must be in the past and not more than a week ago.
error-something-wrong = Something went wrong. Please try again

# System messages
msg-cancelled = Cancelled
msg-saved = Saved successfully
msg-updated = Updated successfully
msg-deleted = Deleted successfully
# Onboarding flow

# Language selection (first screen)
language-welcome = 
  Welcome! 👋
  
  Please select your language:
language-btn-english = 🇬🇧 English
language-btn-russian = 🇷🇺 Русский

# Welcome after language selection
welcome = 
  Welcome to Better Goals! 🎯
  
  This bot helps you track progress in your key life areas.
  
  Let's set up your focus areas (max 7).

# Add areas step
add-areas-prompt = 
  Great! Now let's add your focus areas.
  
  Examples:
  • 💼 Work
  • 🏃 Health
  • 📚 Learning
  
  You can add 1-7 areas. Type /done when finished.

add-first-area = Let's add your first focus area. What's the title?
add-another-area = Area added! Add another or type /done to continue.
areas-added = Perfect! { $count } { $count ->
    [one] area
   *[other] areas
  } added.

# Timezone selection
timezone-select = 
  Select your timezone:
  
  This is needed for reminders and daily digests.
timezone-other = Other (enter manually)
timezone-prompt = Enter your timezone (e.g., Europe/Moscow):
timezone-set = Timezone set to { $timezone }

# Reminder times setup
reminder-digest-prompt = 
  Set time(s) for daily digest (1-3 times).
  
  Format: HH:mm (24-hour)
  Example: 09:00
  
  You can add multiple times. Type /done when finished.

reminder-digest-added = Digest time added: { $time }. Add another or type /done.
reminder-digest-set = Digest times set: { $times }

reminder-progress-prompt = 
  Set time for evening progress reminder (optional).
  
  This reminds you to log progress if you haven't yet.
  Format: HH:mm (e.g., 20:00)
  
  Type /skip to skip.

reminder-progress-set = Progress reminder set to { $time }
reminder-progress-skipped = Progress reminder skipped

# Completion
onboarding-complete = 
  All set! 🎉
  
  Your focus areas are ready. Start logging your daily progress!

onboarding-pin-message =
  I've pinned a message with your focus areas.
  Use the buttons there for quick access.

# Additional onboarding messages
first-area-prompt =
  📌 *First area*

  What life area do you want to focus on?

  _Examples: Work, Health, Learning, Family_
next-area-prompt = 📌 *Add another area*

  What other area matters to you?
btn-done-areas = ✅ Done adding areas
description-prompt = 📝 *Description* (optional)

  Add a short description for "{ $title }":

  _Example: Frontend dev and team management_
emoji-prompt = 😀 *Emoji* (optional)

  Send an emoji to represent this area:
area-count = You have { $count } { $count ->
    [one] area
   *[other] areas
  }. Add more?
max-areas-reached = You've reached the maximum of { $max } areas.
timezone-title = 🌍 *Timezone*

  Select your timezone for accurate reminders:
timezone-custom-prompt = Type your timezone in IANA format:

  _Example: Europe/Berlin, Asia/Singapore, America/Los_Angeles_
digest-title = 📋 *Goals Digest*

  Want daily reminders to review your goals? (up to 3 times/day)
time-format-prompt = Enter time in HH:mm format (e.g., { $example }):
progress-title = 📝 *Progress Reminder*

  Get reminded to log your progress if you haven't yet?
# Progress logging

# Start progress logging
progress-start = Let's log your progress! 📝
progress-no-areas = You don't have any focus areas yet. Add some first!

# Progress form for each area
progress-area-prompt =
    { $current }/{ $total } { $emoji } *{ $title }*
    { $body ->
        [none] {""}
       *[other] → { $body }
    }

    What did you accomplish?

progress-skipped = Skipped
progress-all-done = All areas completed! ✅

# Summary after logging
progress-summary = 
  Progress logged! 🎉
  
  { $count } { $count ->
    [one] entry
   *[other] entries
  } saved for today.
progress-summary-for-date = 
  Progress logged! 🎉
  
  { $count } { $count ->
    [one] entry
   *[other] entries
  } saved for { $date }.

progress-streak = 🔥 { $days } { $days ->
    [one] day
   *[other] days
  } streak!

# Pinned message
pinned-title = 🎯 YOUR FOCUS AREAS
pinned-area-item = { $position }. { $emoji } { $title }{ $body ->
    [none] {""}
   *[other] {"\n"}   → { $body }
  }
pinned-stats = 🔥 { $streak } { $streak ->
    [one] day
   *[other] days
  } | Last: { $lastUpdate }
pinned-no-progress = No progress logged yet

# Additional progress messages
progress-all-caught-up = ✅ *All caught up!*

  You've already logged progress for all areas today.
progress-all-caught-up-for-date = ✅ *All caught up!*

  You've already logged progress for all areas on { $date }.
progress-cancelled = ❌ *Progress logging cancelled*

  No entries were saved from this session.
progress-skipped-area = ⏭ Skipped { $emoji } { $title }
progress-today = today
progress-date-selection = 
  📅 *Select date for logging progress*

  Which date would you like to log progress for?
progress-select-past-date = 
  📆 *Select a past date*

  Choose one of the last three days or enter your own date in DD.MM.YY format (e.g., 01.02.26).
progress-custom-date-prompt = 
  📝 *Enter date*

  Enter date in DD.MM.YY format (e.g., 01.02.26).

  Date must be:
  • In the past (not today or future)
  • Not more than a week ago
# Scheduler messages (digests and reminders)

# Morning digest
digest-title = 🌅 Daily Digest
digest-greeting = Good morning! Here's your focus for today:
digest-areas-title = 🎯 Your Focus Areas:
digest-streak = 🔥 Current streak: { $days } { $days ->
    [one] day
   *[other] days
  }
digest-motivation = Make today count! 💪

# Evening reminder
reminder-title = 🌙 Progress Check
reminder-message = 
  Haven't logged your progress yet today!
  
  Take a moment to reflect on what you accomplished.
reminder-cta = Tap the button below to log your progress:
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
# AI Summary / Prompt generation

summary-title = 🤖 AI Analysis Prompt
summary-period = Select period:
summary-7days = Last 7 days
summary-14days = Last 14 days
summary-30days = Last 30 days
summary-all = All time

summary-generating = Generating prompt...

summary-prompt-intro = 
  # Personal Progress Analysis Request
  
  I'm tracking my key life areas and would like your analysis and recommendations.
  
  **IMPORTANT: Please respond in { $language } language.**

summary-prompt-areas = 
  ## My Focus Areas
  
summary-prompt-progress = 
  ## Progress Entries
  
summary-prompt-stats = 
  ## Statistics
  
  - Current streak: { $streak } { $streak ->
      [one] day
     *[other] days
    }
  - Weekly activity: { $weekly }/7 days
  - Total entries: { $total }

summary-prompt-questions = 
  ## Analysis Questions
  
  1. What patterns do you see in my progress?
  2. Which areas need more attention?
  3. What specific actions can I take to improve?
  4. How can I maintain momentum in strong areas?
  5. Any recommendations for better balance?

summary-ready = 
  ✅ Prompt ready!
  
  Copy the text below and paste it into ChatGPT or Claude:

summary-copy-instruction =
  💡 Tip: Select all text above and copy it to your AI assistant.

# Help command
help-title = 📖 *Better Goals Help*
help-commands = *Commands:*
help-start = /start - Start bot and see your areas
help-areas = /areas - Manage focus areas
help-progress = /progress - Log daily progress
help-summary = /summary - Generate AI analysis prompt
help-settings = /settings - Configure reminders
help-help = /help - Show this message
help-philosophy = *Philosophy:*
help-philosophy-text = Less is more. Focus on up to 7 key areas.
  Log daily progress. Build momentum through consistency.
