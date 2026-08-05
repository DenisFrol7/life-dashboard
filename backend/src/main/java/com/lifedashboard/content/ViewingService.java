package com.lifedashboard.content;
import com.lifedashboard.common.error.*; import com.lifedashboard.content.dto.*; import com.lifedashboard.user.*;
import org.springframework.beans.factory.annotation.Value; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import java.time.Instant; import java.util.*;
@Service @Transactional(readOnly=true)
public class ViewingService {
 private final ContentItemRepository items; private final ContentSeasonRepository seasons; private final ContentEpisodeRepository episodes;
 private final EpisodeWatchRepository episodeWatches; private final MovieWatchRepository movieWatches; private final UserContentRepository library;
 private final UserRepository users; private final long userId;
 public ViewingService(ContentItemRepository i,ContentSeasonRepository s,ContentEpisodeRepository e,EpisodeWatchRepository ew,
 MovieWatchRepository mw,UserContentRepository l,UserRepository u,@Value("${app.default-user-id}")long id){items=i;seasons=s;episodes=e;episodeWatches=ew;movieWatches=mw;library=l;users=u;userId=id;}
 @Transactional public SeasonResponse createSeason(Long contentId,SeasonRequest r){ContentItem c=item(contentId); requireSeries(c);
  if(seasons.existsByContentIdAndSeasonNumber(contentId,r.seasonNumber()))throw new DuplicateResourceException("Season number already exists");
  ContentSeason s=new ContentSeason(c);s.update(r.seasonNumber(),norm(r.title()),r.releaseYear());return response(seasons.save(s));}
 public List<SeasonResponse> seasons(Long id){item(id);return seasons.findAllByContentIdOrderBySeasonNumber(id).stream().map(this::response).toList();}
 @Transactional public EpisodeResponse createEpisode(Long seasonId,EpisodeRequest r){ContentSeason s=season(seasonId);
  if(episodes.existsBySeasonIdAndEpisodeNumber(seasonId,r.episodeNumber()))throw new DuplicateResourceException("Episode number already exists");
  ContentEpisode e=new ContentEpisode(s);e.update(r.episodeNumber(),r.title().trim(),r.durationMinutes(),r.releaseDate()); EpisodeResponse out=response(episodes.save(e));
  library.findAllByContentId(s.getContent().getId()).stream().filter(x->x.getStatus()==UserContentStatus.PAUSED||x.getStatus()==UserContentStatus.COMPLETED).forEach(x->x.changeStatus(UserContentStatus.IN_PROGRESS,null)); return out;}
 public List<EpisodeResponse> episodes(Long id){season(id);return episodes.findAllBySeasonIdOrderByEpisodeNumber(id).stream().map(this::response).toList();}
 @Transactional public WatchResponse watchEpisode(Long id,WatchRequest r){ContentEpisode e=episode(id);User u=user();ensureLibrary(e.getSeason().getContent(),u);
  EpisodeWatch w=episodeWatches.save(new EpisodeWatch(u,e,time(r),episodeWatches.maxNumber(id,userId)+1));refresh(e.getSeason().getContent());return response(w);}
 public List<WatchResponse> episodeHistory(Long id){episode(id);return episodeWatches.findAllByEpisodeIdAndUserIdOrderByWatchNumber(id,userId).stream().map(this::response).toList();}
 @Transactional public WatchResponse watchMovie(Long id,WatchRequest r){ContentItem c=item(id);if(c.getItemType()!=ContentType.MOVIE)throw new InvalidRequestException("Movie watch history is only available for MOVIE");User u=user();UserContent l=ensureLibrary(c,u);
  MovieWatch w=movieWatches.save(new MovieWatch(u,c,time(r),movieWatches.maxNumber(id,userId)+1));l.changeStatus(UserContentStatus.COMPLETED,w.getWatchedAt());return new WatchResponse(w.getId(),id,w.getWatchedAt(),w.getWatchNumber());}
 public List<WatchResponse> movieHistory(Long id){item(id);return movieWatches.findAllByContentIdAndUserIdOrderByWatchNumber(id,userId).stream().map(w->new WatchResponse(w.getId(),id,w.getWatchedAt(),w.getWatchNumber())).toList();}
 public Long contentIdForSeason(Long id){return season(id).getContent().getId();}
 public Long contentIdForEpisode(Long id){return episode(id).getSeason().getContent().getId();}
 private void refresh(ContentItem c){long total=episodes.countByContent(c.getId()),watched=episodeWatches.watchedCount(userId,c.getId());UserContent l=library.findByUserIdAndContentId(userId,c.getId()).orElseThrow();
  if(total>0&&watched==total){if(c.getReleaseStatus()==ReleaseStatus.ONGOING||c.getReleaseStatus()==ReleaseStatus.ANNOUNCED)l.changeStatus(UserContentStatus.PAUSED,null);else l.changeStatus(UserContentStatus.COMPLETED,Instant.now());}else l.changeStatus(UserContentStatus.IN_PROGRESS,null);}
 private UserContent ensureLibrary(ContentItem c,User u){return library.findByUserIdAndContentId(userId,c.getId()).orElseGet(()->{UserContent x=new UserContent(u,c);x.update(UserContentStatus.IN_PROGRESS,null,false,Instant.now(),null,null);return library.save(x);});}
 private void requireSeries(ContentItem c){if(c.getItemType()!=ContentType.SERIES&&c.getItemType()!=ContentType.ANIME)throw new InvalidRequestException("Seasons are only available for SERIES and ANIME");}
 private ContentItem item(Long id){return items.findById(id).orElseThrow(()->new ResourceNotFoundException("Content with id "+id+" was not found"));}
 private ContentSeason season(Long id){return seasons.findById(id).orElseThrow(()->new ResourceNotFoundException("Season with id "+id+" was not found"));}
 private ContentEpisode episode(Long id){return episodes.findById(id).orElseThrow(()->new ResourceNotFoundException("Episode with id "+id+" was not found"));}
 private User user(){return users.findById(userId).orElseThrow(()->new ResourceNotFoundException("Default user was not found"));}
 private Instant time(WatchRequest r){return r==null||r.watchedAt()==null?Instant.now():r.watchedAt();} private String norm(String s){return s==null||s.isBlank()?null:s.trim();}
 private SeasonResponse response(ContentSeason s){return new SeasonResponse(s.getId(),s.getContent().getId(),s.getSeasonNumber(),s.getTitle(),s.getReleaseYear());}
 private EpisodeResponse response(ContentEpisode e){return new EpisodeResponse(e.getId(),e.getSeason().getId(),e.getEpisodeNumber(),e.getTitle(),e.getDurationMinutes(),e.getReleaseDate());}
 private WatchResponse response(EpisodeWatch w){return new WatchResponse(w.getId(),w.getEpisode().getId(),w.getWatchedAt(),w.getWatchNumber());}
}
