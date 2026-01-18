# AI анализ / Генерация промпта

summary-title = 🤖 Промпт для AI анализа
summary-period = Выберите период:
summary-7days = Последние 7 дней
summary-14days = Последние 14 дней
summary-30days = Последние 30 дней
summary-all = Всё время

summary-generating = Генерирую промпт...

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
  ✅ Промпт готов!
  
  Скопируйте текст ниже и вставьте его в ChatGPT или Claude:

summary-copy-instruction = 
  💡 Совет: Выделите весь текст выше и скопируйте его в AI ассистента.
