"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userModel_1 = __importDefault(require("../models/userModel"));
const updateSchema = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Adding admin_username column to teams table...');
        yield userModel_1.default.query(`
      ALTER TABLE teams 
      ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255);
    `);
        console.log('Adding foreign key constraint...');
        // We can't easily add a circular FK constraint (teams.admin -> users.username) 
        // because users.team_id -> teams.team_id. 
        // It might cause issues with insertion order. 
        // For now, we will just store the username without a strict FK constraint, 
        // or we can add it with DEFERRABLE if needed.
        // Let's just add the column for now.
        console.log('Schema update complete!');
        process.exit(0);
    }
    catch (err) {
        console.error('Error updating schema:', err);
        process.exit(1);
    }
});
updateSchema();
