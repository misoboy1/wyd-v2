// 한국어 사전(원본) — 키 구조의 기준. 다른 언어는 이 모양을 따라야 한다(G-09)
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

export const dict = { common, enums, nav, shell, dash, gori, stay, org, board, users, err, valid };
export type Dict = typeof dict;
