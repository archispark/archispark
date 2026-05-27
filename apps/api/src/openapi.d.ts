/**
 * OpenAPI 3.0 specification for the mcp-archimate REST API.
 * Served as JSON at GET /openapi.json and as Swagger UI at GET /docs.
 */
export declare const openApiSpec: {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
        contact: {
            name: string;
            url: string;
        };
    };
    servers: {
        url: string;
        description: string;
    }[];
    tags: {
        name: string;
        description: string;
    }[];
    paths: {
        "/": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        "/save": {
            post: {
                tags: string[];
                summary: string;
                operationId: string;
                description: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "500": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        "/elements/types": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    items: {
                                        type: string;
                                    };
                                    example: string[];
                                };
                            };
                        };
                    };
                };
            };
        };
        "/elements": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: ({
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        enum: string[];
                    };
                    description: string;
                } | {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        enum?: undefined;
                    };
                    description: string;
                })[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                operationId: string;
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    "201": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
        };
        "/elements/{identifier}": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                };
            };
            put: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    "204": {
                        description: string;
                    };
                    "404": {
                        $ref: string;
                    };
                };
            };
        };
        "/relationships/types": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    items: {
                                        type: string;
                                    };
                                    example: string[];
                                };
                            };
                        };
                    };
                };
            };
        };
        "/relationships": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: ({
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        enum: string[];
                    };
                    description: string;
                } | {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        enum?: undefined;
                    };
                    description: string;
                })[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                operationId: string;
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    "201": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
        };
        "/relationships/{identifier}": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                };
            };
            put: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    "204": {
                        description: string;
                    };
                    "404": {
                        $ref: string;
                    };
                };
            };
        };
        "/views": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                operationId: string;
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    "201": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
        };
        "/views/{view_id}/nodes": {
            post: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    "201": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                    "422": {
                        $ref: string;
                    };
                };
            };
        };
        "/views/{view_id}/image": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: ({
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        enum?: undefined;
                        default?: undefined;
                    };
                    description: string;
                } | {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        enum: string[];
                        default: string;
                    };
                    description: string;
                })[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "image/svg+xml": {
                                schema: {
                                    type: string;
                                    format: string;
                                };
                            };
                            "image/png": {
                                schema: {
                                    type: string;
                                    format: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                    "422": {
                        $ref: string;
                    };
                    "500": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        "/views/{identifier}": {
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    "404": {
                        $ref: string;
                    };
                };
            };
        };
        "/mcp/": {
            post: {
                tags: string[];
                summary: string;
                operationId: string;
                description: string;
                requestBody: {
                    required: boolean;
                    content: {
                        "application/json": {
                            schema: {
                                type: string;
                            };
                        };
                    };
                };
                responses: {
                    "200": {
                        description: string;
                    };
                    "400": {
                        description: string;
                    };
                };
            };
            get: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    "200": {
                        description: string;
                    };
                    "405": {
                        description: string;
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                operationId: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    "200": {
                        description: string;
                    };
                    "404": {
                        description: string;
                    };
                };
            };
        };
    };
    components: {
        schemas: {
            RGBColor: {
                type: string;
                properties: {
                    r: {
                        type: string;
                        minimum: number;
                        maximum: number;
                    };
                    g: {
                        type: string;
                        minimum: number;
                        maximum: number;
                    };
                    b: {
                        type: string;
                        minimum: number;
                        maximum: number;
                    };
                };
                required: string[];
            };
            Font: {
                type: string;
                properties: {
                    name: {
                        type: string;
                        nullable: boolean;
                    };
                    size: {
                        type: string;
                        nullable: boolean;
                    };
                    style: {
                        type: string;
                        nullable: boolean;
                    };
                    color: {
                        $ref: string;
                        nullable: boolean;
                    };
                };
            };
            Style: {
                type: string;
                properties: {
                    fill_color: {
                        $ref: string;
                        nullable: boolean;
                    };
                    line_color: {
                        $ref: string;
                        nullable: boolean;
                    };
                    font: {
                        $ref: string;
                        nullable: boolean;
                    };
                    line_width: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            Property: {
                type: string;
                required: string[];
                properties: {
                    property_definition_ref: {
                        type: string;
                    };
                    value: {
                        type: string;
                    };
                };
            };
            SaveResult: {
                type: string;
                required: string[];
                properties: {
                    saved: {
                        type: string;
                        example: boolean;
                    };
                    path: {
                        type: string;
                        example: string;
                    };
                };
            };
            ModelInfo: {
                type: string;
                required: string[];
                properties: {
                    identifier: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    version: {
                        type: string;
                        nullable: boolean;
                    };
                    element_count: {
                        type: string;
                    };
                    relationship_count: {
                        type: string;
                    };
                    view_count: {
                        type: string;
                    };
                };
            };
            Element: {
                type: string;
                required: string[];
                properties: {
                    identifier: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    properties: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            ElementCreateInput: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        example: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                        example: string;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    properties: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            ElementUpdateInput: {
                type: string;
                properties: {
                    name: {
                        type: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    properties: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            Relationship: {
                type: string;
                required: string[];
                properties: {
                    identifier: {
                        type: string;
                    };
                    name: {
                        type: string;
                        nullable: boolean;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    source: {
                        type: string;
                        description: string;
                    };
                    source_name: {
                        type: string;
                        nullable: boolean;
                    };
                    target: {
                        type: string;
                        description: string;
                    };
                    target_name: {
                        type: string;
                        nullable: boolean;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    properties: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    access_type: {
                        type: string;
                        enum: string[];
                        nullable: boolean;
                        description: string;
                    };
                    is_directed: {
                        type: string;
                        nullable: boolean;
                        description: string;
                    };
                    modifier: {
                        type: string;
                        nullable: boolean;
                        description: string;
                    };
                };
            };
            RelationshipCreateInput: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        nullable: boolean;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    source: {
                        type: string;
                        description: string;
                    };
                    target: {
                        type: string;
                        description: string;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    properties: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    access_type: {
                        type: string;
                        enum: string[];
                        nullable: boolean;
                    };
                    is_directed: {
                        type: string;
                        nullable: boolean;
                    };
                    influence_strength: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            RelationshipUpdateInput: {
                type: string;
                properties: {
                    name: {
                        type: string;
                        nullable: boolean;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    source: {
                        type: string;
                    };
                    target: {
                        type: string;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    properties: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    access_type: {
                        type: string;
                        enum: string[];
                        nullable: boolean;
                    };
                    is_directed: {
                        type: string;
                        nullable: boolean;
                    };
                    influence_strength: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            Node: Record<string, unknown>;
            Connection: {
                type: string;
                required: string[];
                properties: {
                    identifier: {
                        type: string;
                    };
                    name: {
                        type: string;
                        nullable: boolean;
                    };
                    relationship_ref: {
                        type: string;
                        nullable: boolean;
                    };
                    source: {
                        type: string;
                        nullable: boolean;
                    };
                    target: {
                        type: string;
                        nullable: boolean;
                    };
                    style: {
                        $ref: string;
                        nullable: boolean;
                    };
                };
            };
            View: {
                type: string;
                required: string[];
                properties: {
                    identifier: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                    viewpoint: {
                        type: string;
                        nullable: boolean;
                    };
                    node_count: {
                        type: string;
                    };
                    connection_count: {
                        type: string;
                    };
                };
            };
            ViewDetail: {
                allOf: ({
                    $ref: string;
                    type?: undefined;
                    required?: undefined;
                    properties?: undefined;
                } | {
                    type: string;
                    required: string[];
                    properties: {
                        nodes: {
                            type: string;
                            items: {
                                $ref: string;
                            };
                        };
                        connections: {
                            type: string;
                            items: {
                                $ref: string;
                            };
                        };
                    };
                    $ref?: undefined;
                })[];
            };
            ViewCreateInput: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        example: string;
                    };
                    viewpoint: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    documentation: {
                        type: string;
                        nullable: boolean;
                    };
                };
            };
            NodeCreateInput: {
                type: string;
                required: string[];
                properties: {
                    element_id: {
                        type: string;
                        description: string;
                    };
                    x: {
                        type: string;
                        nullable: boolean;
                        example: number;
                    };
                    y: {
                        type: string;
                        nullable: boolean;
                        example: number;
                    };
                    w: {
                        type: string;
                        nullable: boolean;
                        example: number;
                    };
                    h: {
                        type: string;
                        nullable: boolean;
                        example: number;
                    };
                };
            };
            ErrorDetail: {
                type: string;
                required: string[];
                properties: {
                    detail: {
                        type: string;
                    };
                };
            };
        };
        responses: {
            NotFound: {
                description: string;
                content: {
                    "application/json": {
                        schema: {
                            $ref: string;
                        };
                    };
                };
            };
            UnprocessableType: {
                description: string;
                content: {
                    "application/json": {
                        schema: {
                            $ref: string;
                        };
                    };
                };
            };
        };
    };
};
//# sourceMappingURL=openapi.d.ts.map