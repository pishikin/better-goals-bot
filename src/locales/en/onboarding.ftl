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
