// fr 사전 — 웹에서는 이 언어를 고를 때 따로 받는 청크가 된다
import type { Shape } from "../../core.js";
import type { Dict } from "../ko/index.js";
import { common } from "./common.js";
import { enums } from "./enums.js";
import { nav } from "./nav.js";
import { shell } from "./shell.js";
import { dash } from "./dash.js";
import { gori } from "./gori.js";
import { stay } from "./stay.js";
import { org } from "./org.js";
import { board } from "./board.js";
import { users } from "./users.js";
import { err } from "./err.js";
import { valid } from "./valid.js";

export const dict = { common, enums, nav, shell, dash, gori, stay, org, board, users, err, valid } satisfies Shape<Dict>;
