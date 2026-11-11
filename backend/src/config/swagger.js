import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MedLink API - Module Patient (M2)",
      version: "1.0.0",
      description: "Documentation de l'API pour la prise de rendez-vous",
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Serveur local",
      },
    ],
    // AJOUTE CECI :
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/modules/**/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
