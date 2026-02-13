
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSystem {
    async readFile(filePath: string): Promise<string> {
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw error;
        }
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            throw error;
        }
    }

    async listDir(dirPath: string): Promise<string[]> {
        try {
            const entires = await fs.readdir(dirPath, { withFileTypes: true });
            return entires.map(entry => {
                const type = entry.isDirectory() ? 'DIR' : 'FILE';
                return `${type}: ${entry.name}`;
            });
        } catch (error) {
            console.error(`Error listing directory ${dirPath}:`, error);
            throw error;
        }
    }
}
