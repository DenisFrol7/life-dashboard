package com.lifedashboard.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI lifeDashboardOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Life Dashboard API")
                        .version("1.0.0")
                        .description("REST API домашней панели Life Dashboard. " +
                                "Ошибки валидации, отсутствующие ресурсы и конфликты возвращаются " +
                                "в едином формате ApiError со статусами 400, 404 и 409."))
                .tags(List.of(
                        tag("Dashboard", "Дневная сводка"),
                        tag("Activity", "Ежедневная активность"),
                        tag("Sleep", "Сессии сна"),
                        tag("Habits", "Привычки и их выполнение"),
                        tag("Calendar", "События, задачи и напоминания"),
                        tag("Journal", "Дневник и теги"),
                        tag("Blog", "Публикации блога"),
                        tag("Content", "Общий каталог и личная медиатека"),
                        tag("Anime", "Многосерийное аниме"),
                        tag("Games", "Игровая библиотека и Xbox-прогресс"),
                        tag("Users", "Пользователи")
                ));
    }

    private Tag tag(String name, String description) {
        return new Tag().name(name).description(description);
    }
}
