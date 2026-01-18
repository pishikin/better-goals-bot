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
