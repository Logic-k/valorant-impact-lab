const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Seoul",
  year: "numeric",
})

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Seoul",
  year: "numeric",
})

export function formatKoreanDateTime(value: string): string {
  return formatParts(DATE_TIME_FORMATTER, value, true)
}

export function formatKoreanDate(value: string): string {
  return formatParts(DATE_FORMATTER, value, false)
}

function formatParts(formatter: Intl.DateTimeFormat, value: string, includeTime: boolean): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "날짜 없음"
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  const dateLabel = `${parts["year"]}.${parts["month"]}.${parts["day"]}`
  return includeTime ? `${dateLabel} ${parts["hour"]}:${parts["minute"]}` : dateLabel
}
