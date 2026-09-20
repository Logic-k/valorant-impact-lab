export class HenrikDevUnavailableError extends Error {
  readonly name = "HenrikDevUnavailableError"
}

export class RiotProviderUnavailableError extends Error {
  readonly name = "RiotProviderUnavailableError"

  constructor() {
    super("Riot provider is reserved for the approved Production Key path")
  }
}
