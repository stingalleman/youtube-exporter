# youtube-exporter

> Extract information from the YouTube API and export it to Prometheus

## Endpoints

### yt_streamStatus_counter

[API docs](https://developers.google.com/youtube/v3/live/docs/liveStreams)

| Value | Description |
|-------|-------------|
| 0     | Inactive    |
| 1     | Error       |
| 3     | Created     |
| 4     | Ready       |
| 5     | Active      |
