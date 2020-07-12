# youtube-exporter

> Extract information from the YouTube API and export it to Prometheus

## Endpoints

### yt_streamStatus_counter

> The stream's status.

[API docs](https://developers.google.com/youtube/v3/live/docs/liveStreams#status.streamStatus)

| Value | Description |
|-------|-------------|
| 0     | Inactive    |
| 1     | Error       |
| 2     | Created     |
| 3     | Ready       |
| 4     | Active      |

### yt_healthStatus_counter

> The status code of this stream.

[API docs](https://developers.google.com/youtube/v3/live/docs/liveStreams#status.healthStatus.status)

| Value | Description |
|-------|-------------|
| 0     | noData      |
| 1     | bad         |
| 2     | ok          |
| 3     | good        |

### yt_concurrentViewers_counter

> Concurrent viewers
