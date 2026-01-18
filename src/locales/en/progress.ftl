# Progress logging

# Start progress logging
progress-start = Let's log your progress! 📝
progress-no-areas = You don't have any focus areas yet. Add some first!

# Progress form for each area
progress-area-prompt = 
  { $current }/{ $total } { $emoji } { $title }{ $body ->
    [none] {""}
   *[other] {"\n"}→ { $body }
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
progress-cancelled = ❌ *Progress logging cancelled*

  No entries were saved from this session.
progress-skipped-area = ⏭ Skipped { $emoji } { $title }
