export interface BannerMessage {
  kind: 'error' | 'success'
  code?: string
  message: string
}

interface MessageBannerProps {
  banner: BannerMessage | null
}

export function MessageBanner({ banner }: MessageBannerProps) {
  if (banner === null) {
    return null
  }

  return (
    <div className={`message-banner message-banner--${banner.kind}`} role={banner.kind === 'error' ? 'alert' : 'status'}>
      {banner.code ? <span className="message-banner__code">{banner.code}</span> : null}
      <span>{banner.message}</span>
    </div>
  )
}
