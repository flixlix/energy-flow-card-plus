import {
  ActionConfig,
  BaseActionConfig,
  HapticType,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from 'custom-card-helpers';
import { HassEntity, HassServiceTarget } from 'home-assistant-js-websocket';
import { UNIT_PREFIXES } from './const';

declare global {
  interface HTMLElementTagNameMap {

    'hui-error-card': LovelaceCard;
  }
}

export type BoxType = 'entity' | 'passthrough' | 'remaining_parent_state' | 'remaining_child_state';

export interface EntityConfig {
  entity_id: string;
  add_entities?: string[];
  subtract_entities?: string[];
  // @deprecated #100
  substract_entities?: string[];
  attribute?: string;
  type?: BoxType;
  children?: string[];
  unit_of_measurement?: string; // for attribute
  color?: string;
  name?: string;
  icon?: string;
  color_on_state?: boolean;
  color_above?: string;
  color_below?: string;
  color_limit?: number;
  tap_action?: ActionConfigExtended;
  // @deprecated
  remaining?:
    | string
    | {
        name: string;
        color?: string;
      };
}

export type EntityConfigInternal = EntityConfig & {
  children: string[];
  accountedState?: number;
  foundChildren?: string[];
};

export type EntityConfigOrStr = string | EntityConfig;

export type ActionConfigExtended = ActionConfig | CallServiceActionConfig | MoreInfoActionConfig;

export interface MoreInfoActionConfig extends BaseActionConfig {
  action: 'more-info';
  entity?: string;
  data?: {
    entity_id?: string | [string];
  };
}

export interface CallServiceActionConfig extends BaseActionConfig {
  action: 'call-service';
  service: string;
  data?: {
    entity_id?: string | [string];
    [key: string]: unknown;
  };
  target?: HassServiceTarget;
  repeat?: number;
  haptic?: HapticType;
}

export interface SectionConfig {
  entities: EntityConfigOrStr[];
  sort_by?: 'state';
  sort_dir?: 'asc' | 'desc';
  min_width?: string;
}

export interface EnergyFlowCardPlusConfig extends LovelaceCardConfig {
  type: string;
  autoconfig?: {
    print_yaml?: boolean;
  };
  title?: string;
  sections?: SectionConfig[];
  unit_prefix?: '' | keyof typeof UNIT_PREFIXES;
  round?: number;
  height?: number;
  wide?: boolean;
  show_icons?: boolean;
  show_names?: boolean;
  show_states?: boolean;
  show_units?: boolean;
  energy_date_selection?: boolean;
  min_box_height?: number;
  min_box_distance?: number;
  throttle?: number;
  min_state?: number;
}

export interface Section {
  entities: EntityConfigInternal[];
  sort_by?: 'state';
  sort_dir?: 'asc' | 'desc';
  min_width?: string;
}

export interface Config extends EnergyFlowCardPlusConfig {
  unit_prefix: '' | keyof typeof UNIT_PREFIXES;
  round: number;
  height: number;
  min_box_height: number;
  min_box_distance: number;
  min_state: number;
  sections: Section[];
}

export interface Connection {
  startY: number;
  startSize: number;
  endY: number;
  endSize: number;
  state: number;
  startColor?: string;
  endColor?: string;
  highlighted?: boolean;
}

export interface Box {
  config: EntityConfigInternal;
  entity: Omit<HassEntity, 'state'> & {
    state: string | number;
  };
  entity_id: string;
  state: number;
  unit_of_measurement?: string;
  children: string[];
  color: string;
  size: number;
  top: number;
  extraSpacers?: number;
  connections: {
    parents: Connection[];
  };
}

export interface SectionState {
  boxes: Box[];
  total: number;
  spacerH: number;
  statePerPixelY: number;
}

export interface ConnectionState {
  parent: EntityConfigInternal;
  child: EntityConfigInternal;
  state: number;
  prevParentState: number;
  prevChildState: number;
  ready: boolean;
  highlighted?: boolean;
}

export interface NormalizedState {
  state: number;
  unit_of_measurement?: string;
}











export type ComboEntity = {
  consumption: string;
  production: string;
};

export type SecondaryInfoType = {
  entity?: string;
  unit_of_measurement?: string;
  icon?: string;
  display_zero?: boolean;
  unit_white_space?: boolean;
  display_zero_tolerance?: number;
  color_value?: boolean | "production" | "consumption";
  template?: string;
};

export interface baseConfigEntity {
  entity: string | ComboEntity;
  name?: string;
  icon?: string;
  color?: ComboEntity | string;
  color_icon?: boolean | string;
  display_state?: "two_way" | "one_way" | "one_way_no_zero";
  display_zero_tolerance?: number;
  unit_of_measurement?: string;
  use_metadata?: boolean;
  secondary_info?: SecondaryInfoType;
}

export type gridPowerOutage = {
  entity: string;
  state_alert?: string;
  label_alert?: string;
  icon_alert?: string;
};

export type IndividualDeviceType = {
  entity: string;
  name?: string;
  icon?: string;
  color?: string;
  color_icon?: boolean;
  inverted_animation?: boolean;
  unit_of_measurement?: string;
  display_zero?: boolean;
  display_zero_state?: boolean;
  display_zero_tolerance?: number;
  secondary_info?: SecondaryInfoType;
  color_value?: boolean;
  color_label?: boolean;
  calculate_flow_rate?: boolean;
  use_metadata?: boolean;
};

export type EntityType =
  | "battery"
  | "grid"
  | "solar"
  | "individual1"
  | "individual1Secondary"
  | "individual2"
  | "individual2Secondary"
  | "solarSecondary"
  | "homeSecondary"
  | "gridSecondary"
  | "nonFossilSecondary";
