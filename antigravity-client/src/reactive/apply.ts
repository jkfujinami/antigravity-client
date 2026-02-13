
import { Message, proto3 } from "@bufbuild/protobuf";
import type { MessageType, FieldInfo } from "@bufbuild/protobuf";
import { MessageDiff, FieldDiff, SingularValue, RepeatedDiff, MapDiff } from "../gen/exa/reactive_component_pb_pb.js";

/**
 * Applies a MessageDiff to a target object (which should be a plain JS object representation of a message).
 * @param target The object to modify in place.
 * @param diff The MessageDiff to apply.
 * @param type The MessageType metadata for the target object.
 */
export function applyMessageDiff(target: any, diff: MessageDiff, type: MessageType) {
    if (!diff.fieldDiffs) return;

    for (const fieldDiff of diff.fieldDiffs) {
        applyFieldDiff(target, fieldDiff, type);
    }
}

function applyFieldDiff(target: any, fd: FieldDiff, type: MessageType) {
    const field = type.fields.find(fd.fieldNumber);
    if (!field) {
        console.warn(`[applyFieldDiff] Field ${fd.fieldNumber} not found in ${type.typeName}`);
        return;
    }

    const localName = field.localName;

    let value: any;
    switch (fd.diff.case) {
        case "updateSingular":
            value = extractSingularValue(fd.diff.value, field);
            break;
        case "updateRepeated":
            applyRepeatedDiff(target, localName, fd.diff.value, field);
            return;
        case "updateMap":
            applyMapDiff(target, localName, fd.diff.value, field);
            return;
        case "clear":
            if (fd.diff.value) value = undefined;
            else return;
            break;
    }

    if (field.oneof) {
        target[field.oneof.localName] = { case: localName, value };
    } else {
        target[localName] = value;
    }
}

function extractSingularValue(sv: SingularValue, field: FieldInfo): any {
    if (!sv.value) return undefined;

    switch (sv.value.case) {
        case "doubleValue": return sv.value.value;
        case "floatValue": return sv.value.value;
        case "int32Value": return sv.value.value;
        case "int64Value": return sv.value.value;
        case "uint32Value": return sv.value.value;
        case "uint64Value": return sv.value.value;
        case "sint32Value": return sv.value.value;
        case "sint64Value": return sv.value.value;
        case "fixed32Value": return sv.value.value;
        case "fixed64Value": return sv.value.value;
        case "sfixed32Value": return sv.value.value;
        case "sfixed64Value": return sv.value.value;
        case "boolValue": return sv.value.value;
        case "enumValue": return sv.value.value;
        case "stringValue": return sv.value.value;
        case "bytesValue": return sv.value.value;
        case "messageValue":
            if (field.kind !== "message") {
                console.warn(`[extractSingularValue] Message value for non-message field ${field.name}`);
                return undefined;
            }
            // If the target field is a message, we might need to create it if it doesn't exist
            // and then apply the sub-diff.
            // But usually the diff already knows the structure.
            // For simplicity, let's assume we want a plain object.
            const subType = field.T as MessageType;
            const subObj = {}; // This is tricky because we might need to merge with existing
            applyMessageDiff(subObj, sv.value.value, subType);
            return subObj;
    }
}

function applyRepeatedDiff(target: any, localName: string, rd: RepeatedDiff, field: FieldInfo) {
    if (!Array.isArray(target[localName])) {
        target[localName] = [];
    }
    const arr = target[localName];

    // Handle length change
    if (rd.newLength !== undefined) {
        if (arr.length > rd.newLength) {
            arr.splice(rd.newLength);
        } else while (arr.length < rd.newLength) {
            arr.push(undefined);
        }
    }

    if (rd.updateIndices && rd.updateValues) {
        for (let i = 0; i < rd.updateIndices.length; i++) {
            const idx = rd.updateIndices[i];
            const val = rd.updateValues[i];

            if (field.kind === "message") {
                if (!arr[idx]) arr[idx] = {};
                // If it's a messageValue in val, we should apply it.
                // Wait, RepeatedDiff usually sends the full SingularValue for each updated index.
                if (val.value.case === "messageValue") {
                   applyMessageDiff(arr[idx], val.value.value, field.T as MessageType);
                } else {
                   arr[idx] = extractSingularValue(val, field);
                }
            } else {
                arr[idx] = extractSingularValue(val, field);
            }
        }
    }
}

function applyMapDiff(target: any, localName: string, md: MapDiff, field: FieldInfo) {
    if (field.kind !== "map") return;
    if (!target[localName]) target[localName] = {};
    const map = target[localName];

    for (const keyDiff of md.mapKeyDiffs) {
        // Find the key value. We'll convert it to a string for JS object keying.
        const key = String(extractSingularValue(keyDiff.mapKey!, { kind: "scalar", T: field.K as any } as any));

        if (keyDiff.diff.case === "updateSingular") {
            map[key] = extractSingularValue(keyDiff.diff.value, { kind: field.V.kind, T: field.V.T } as any);
        } else if (keyDiff.diff.case === "clear" && keyDiff.diff.value) {
            delete map[key];
        }
    }
}
