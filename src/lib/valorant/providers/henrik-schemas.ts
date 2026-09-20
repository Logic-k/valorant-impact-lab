import { z } from "zod"

export const AccountSchema = z
  .object({
    account_level: z.number().optional(),
    name: z.string(),
    region: z.string().optional(),
    tag: z.string(),
  })
  .passthrough()

export const MmrSchema = z
  .object({
    current_data: z
      .object({
        currenttierpatched: z.string().optional(),
        mmr_change_to_last_game: z.number().optional(),
        ranking_in_tier: z.number().optional(),
      })
      .passthrough()
      .optional(),
    currenttierpatched: z.string().optional(),
    ranking_in_tier: z.number().optional(),
  })
  .passthrough()

export const StoredMatchSchema = z
  .object({
    meta: z
      .object({
        id: z.string(),
        map: z.object({ name: z.string() }).passthrough(),
        mode: z.string(),
        started_at: z.string(),
      })
      .passthrough(),
    stats: z
      .object({
        assists: z.number(),
        character: z.object({ name: z.string() }).passthrough(),
        damage: z.object({ made: z.number(), received: z.number() }).passthrough(),
        deaths: z.number(),
        kills: z.number(),
        level: z.number().optional(),
        score: z.number(),
        shots: z.object({ body: z.number(), head: z.number(), leg: z.number() }).passthrough(),
        team: z.string(),
        tier: z.number().optional(),
      })
      .passthrough(),
    teams: z.object({ blue: z.number(), red: z.number() }).passthrough(),
  })
  .passthrough()

export const AccountEnvelopeSchema = z.object({
  data: AccountSchema.nullable(),
  status: z.number(),
})

export const MmrEnvelopeSchema = z.object({
  data: MmrSchema.nullable(),
  status: z.number(),
})

export const StoredMatchesEnvelopeSchema = z.object({
  data: z.array(StoredMatchSchema).nullable(),
  status: z.number(),
})

const LocationSchema = z.object({ x: z.number(), y: z.number() }).passthrough()

const AssistantSchema = z
  .object({
    assistant_puuid: z.string().optional(),
    puuid: z.string().optional(),
  })
  .passthrough()

const KillEventSchema = z
  .object({
    assistants: z.array(AssistantSchema).optional().default([]),
    kill_time_in_round: z.number(),
    killer_puuid: z.string(),
    killer_team: z.string(),
    player_locations_on_kill: z
      .array(
        z
          .object({
            location: LocationSchema,
            player_puuid: z.string(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
    round: z.number().optional(),
    victim_death_location: LocationSchema.optional(),
    victim_puuid: z.string(),
    victim_team: z.string(),
  })
  .passthrough()

const EconomySchema = z
  .object({
    armor: z.object({ name: z.string().nullable().optional() }).passthrough().optional(),
    loadout_value: z.number(),
    remaining: z.number(),
    spent: z.number(),
    weapon: z.object({ name: z.string().nullable().optional() }).passthrough().optional(),
  })
  .passthrough()

export const MatchDetailSchema = z
  .object({
    kills: z.array(KillEventSchema).optional().default([]),
    metadata: z
      .object({
        game_start: z.number().optional(),
        game_start_patched: z.string().optional(),
        map: z.string(),
        matchid: z.string().optional(),
        match_id: z.string().optional(),
      })
      .passthrough(),
    players: z
      .object({
        all_players: z.array(
          z
            .object({
              name: z.string(),
              puuid: z.string(),
              tag: z.string(),
              team: z.string(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
    rounds: z.array(
      z
        .object({
          defuse_events: z
            .object({ defuse_location: LocationSchema.nullable().optional() })
            .passthrough()
            .nullable()
            .optional(),
          plant_events: z
            .object({ plant_location: LocationSchema.nullable().optional() })
            .passthrough()
            .nullable()
            .optional(),
          player_stats: z.array(
            z
              .object({
                damage: z.number(),
                economy: EconomySchema,
                headshots: z.number().optional().default(0),
                kills: z.number(),
                player_puuid: z.string(),
                player_team: z.string(),
                score: z.number(),
              })
              .passthrough(),
          ),
          winning_team: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough()

export const MatchDetailEnvelopeSchema = z.object({
  data: MatchDetailSchema.nullable(),
  status: z.number(),
})

export const HenrikErrorEnvelopeSchema = z.object({
  errors: z.array(
    z
      .object({
        message: z.string(),
      })
      .passthrough(),
  ),
})

export type AccountData = z.infer<typeof AccountSchema>
export type MatchDetailData = z.infer<typeof MatchDetailSchema>
export type MmrData = z.infer<typeof MmrSchema>
export type StoredMatchData = z.infer<typeof StoredMatchSchema>
