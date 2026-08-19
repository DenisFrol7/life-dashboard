package com.lifedashboard.dashboard;

import com.lifedashboard.activity.*;
import com.lifedashboard.calendar.*;
import com.lifedashboard.content.*;
import com.lifedashboard.dashboard.dto.DashboardResponse;
import com.lifedashboard.habit.*;
import com.lifedashboard.game.*;
import com.lifedashboard.journal.JournalEntryRepository;
import com.lifedashboard.sleep.*;
import com.lifedashboard.user.*;
import com.lifedashboard.common.error.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.jspecify.annotations.NonNull;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class DashboardService {
    private final DailyActivityRepository activities; private final SleepSessionRepository sleepSessions;
    private final HabitRepository habits; private final HabitEntryRepository habitEntries;
    private final CalendarEventRepository events; private final CalendarEventOccurrenceRepository occurrences;
    private final JournalEntryRepository journal; private final UserContentRepository library;
    private final GameSessionRepository gameSessions;
    private final UserRepository users; private final long userId;

    public DashboardService(DailyActivityRepository activities, SleepSessionRepository sleepSessions,
            HabitRepository habits, HabitEntryRepository habitEntries, CalendarEventRepository events,
            CalendarEventOccurrenceRepository occurrences, JournalEntryRepository journal,
            UserContentRepository library, GameSessionRepository gameSessions, UserRepository users,
            @Value("${app.default-user-id}") long userId) {
        this.activities=activities; this.sleepSessions=sleepSessions; this.habits=habits;
        this.habitEntries=habitEntries; this.events=events; this.occurrences=occurrences;
        this.journal=journal; this.library=library; this.gameSessions=gameSessions;
        this.users=users; this.userId=userId;
    }

    public DashboardResponse get(LocalDate date) {
        User user = users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Default user was not found"));
        ZoneId zone = ZoneId.of(user.getTimezone());
        if (date == null) date = LocalDate.now(zone);
        return new DashboardResponse(date, activity(date), sleep(date, zone), habit(date), calendar(date),
                journal.countByUserIdAndEntryDate(userId, date), gaming(date, zone), media());
    }
    private DashboardResponse.GamingSummary gaming(LocalDate date, ZoneId zone) {
        Instant from=date.atStartOfDay(zone).toInstant(), to=date.plusDays(1).atStartOfDay(zone).toInstant();
        List<GameSession> sessions=gameSessions.findAllByLibraryEntryUserContentUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(userId,from,to);
        return new DashboardResponse.GamingSummary(sessions.stream()
                .mapToLong((@NonNull GameSession session) -> session.getDurationMinutes()).sum(),sessions.size());
    }
    private DashboardResponse.ActivitySummary activity(LocalDate date) {
        return activities.findByUserIdAndActivityDate(userId, date)
                .map(a -> new DashboardResponse.ActivitySummary(a.getSteps(), a.getDistanceMeters()))
                .orElseGet(() -> new DashboardResponse.ActivitySummary(null, null));
    }
    private DashboardResponse.SleepSummary sleep(LocalDate date, ZoneId zone) {
        Instant from=date.atStartOfDay(zone).toInstant(), to=date.plusDays(1).atStartOfDay(zone).toInstant();
        List<SleepSession> sessions=sleepSessions.findAllByUserIdAndEndedAtGreaterThanEqualAndEndedAtLessThan(userId,from,to);
        long minutes=sessions.stream().mapToLong(s->Duration.between(s.getStartedAt(),s.getEndedAt()).toMinutes()).sum();
        OptionalDouble avg=sessions.stream().filter(s->s.getQualityRating()!=null)
                .mapToInt((@NonNull SleepSession session) -> session.getQualityRating()).average();
        return new DashboardResponse.SleepSummary(minutes,avg.isPresent()?(int)Math.round(avg.getAsDouble()):null,sessions.size());
    }
    private DashboardResponse.HabitSummary habit(LocalDate date) {
        List<Habit> scheduled=habits.findAllByUserIdOrderByStartDateAscIdAsc(userId).stream()
                .filter(h->scheduled(h,date)).toList();
        Map<Long,HabitEntry> entriesByHabit=new HashMap<>();
        for(HabitEntry entry:habitEntries.findAllByHabitUserIdAndEntryDate(userId,date))
            entriesByHabit.put(entry.getHabit().getId(),entry);
        int completed=0,skipped=0;
        for(Habit h:scheduled){HabitEntry entry=entriesByHabit.get(h.getId());
            if(entry!=null&&entry.isSkipped())skipped++; else if(entry!=null&&completed(h,entry))completed++;}
        double percent=scheduled.isEmpty()?0.0:Math.round(completed*10000.0/scheduled.size())/100.0;
        return new DashboardResponse.HabitSummary(scheduled.size(),completed,skipped,percent);
    }
    private boolean scheduled(Habit h,LocalDate d){return h.getStatus()==HabitStatus.ACTIVE&&!d.isBefore(h.getStartDate())
            &&(h.getEndDate()==null||!d.isAfter(h.getEndDate()))&&(h.getScheduleType()==HabitScheduleType.DAILY
            ||h.getScheduleDays().contains((short)d.getDayOfWeek().getValue()));}
    private boolean completed(Habit h,HabitEntry e){if(e.getValue()==null)return false;if(h.getTrackingType()==TrackingType.BOOLEAN)return e.getValue().compareTo(BigDecimal.ONE)==0;
        BigDecimal target=e.getTargetValueSnapshot()!=null?e.getTargetValueSnapshot():h.getTargetValue();return target==null||e.getValue().compareTo(target)>=0;}
    private DashboardResponse.CalendarSummary calendar(LocalDate date){List<CalendarEvent> day=events.findCandidatesForDate(userId,date).stream().filter(e->scheduled(e,date)).toList();
        Map<Long,CalendarEventOccurrence> occurrencesByEvent=new HashMap<>();
        for(CalendarEventOccurrence occurrence:occurrences.findAllByEventUserIdAndOccurrenceDate(userId,date))
            occurrencesByEvent.put(occurrence.getEvent().getId(),occurrence);
        int eventCount=0,reminders=0,done=0,pending=0;for(CalendarEvent e:day){if(e.getEventType()==EventType.EVENT)eventCount++;else if(e.getEventType()==EventType.REMINDER)reminders++;
            else {CalendarEventOccurrence occurrence=occurrencesByEvent.get(e.getId());boolean complete=occurrence!=null&&occurrence.getStatus()==OccurrenceStatus.COMPLETED;if(complete)done++;else pending++;}}
        return new DashboardResponse.CalendarSummary(day.size(),eventCount,reminders,done,pending);}
    private boolean scheduled(CalendarEvent e,LocalDate d){if(e.getStatus()!=CalendarEventStatus.ACTIVE||d.isBefore(e.getStartDate())||(e.getRepeatUntil()!=null&&d.isAfter(e.getRepeatUntil())))return false;
        return switch(e.getScheduleType()){case ONCE->d.equals(e.getStartDate());case DAILY->true;case WEEKLY->d.getDayOfWeek()==e.getStartDate().getDayOfWeek();case SELECTED_DAYS->e.getScheduleDays().contains((short)d.getDayOfWeek().getValue());};}
    private DashboardResponse.MediaSummary media(){int movies=0,series=0,pausedSeries=0,anime=0,pausedAnime=0,games=0;
        for(UserContent e:library.findAllByUserIdOrderByIdDesc(userId)){ContentType type=e.getContent().getItemType();UserContentStatus status=e.getStatus();
            if(type==ContentType.MOVIE&&status==UserContentStatus.IN_PROGRESS)movies++;if(type==ContentType.SERIES&&status==UserContentStatus.IN_PROGRESS)series++;
            if(type==ContentType.SERIES&&status==UserContentStatus.PAUSED)pausedSeries++;if(type==ContentType.ANIME&&status==UserContentStatus.IN_PROGRESS)anime++;
            if(type==ContentType.ANIME&&status==UserContentStatus.PAUSED)pausedAnime++;if(type==ContentType.GAME&&status==UserContentStatus.IN_PROGRESS)games++;}
        return new DashboardResponse.MediaSummary(movies,series,pausedSeries,anime,pausedAnime,games);}
}
